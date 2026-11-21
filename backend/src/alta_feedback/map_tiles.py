"""Branch map base layer: /map/serbia.pmtiles is served from an R2 bucket, not from git.

The file weighs ~50 MB and must not live in the repository. The service reaches R2 over the S3 API
(SigV4 signature, standard library only) and forwards Range, because pmtiles in the browser reads
the file in chunks. Keys come from the environment (.env, which the deploy builds from Vault).
"""

import datetime as dt
import hashlib
import hmac
import os
import urllib.error
import urllib.request
from collections.abc import Awaitable, Callable, Iterator
from dataclasses import dataclass
from typing import Protocol

from starlette.concurrency import iterate_in_threadpool, run_in_threadpool
from starlette.requests import Request
from starlette.responses import PlainTextResponse, Response, StreamingResponse

# Cloudflare caches by file extension and .pmtiles is not on its list: without a cache rule on
# the zone the header does nothing. A day: replacing the file under the same name requires a purge.
TILES_CACHE = "public, max-age=86400"
CHUNK = 256 * 1024
R2_ENV = (
    "R2_MAP_ACCOUNT_ID", "R2_MAP_ACCESS_KEY_ID", "R2_MAP_SECRET_ACCESS_KEY", "R2_MAP_BUCKET", "R2_MAP_KEY",
)
PASSTHROUGH = ("content-type", "content-length", "content-range", "etag", "last-modified")


@dataclass(frozen=True)
class R2Config:
    account_id: str
    access_key_id: str
    secret_access_key: str
    bucket: str
    key: str

    @property
    def host(self) -> str:
        return f"{self.account_id}.r2.cloudflarestorage.com"


def config_from_env(env: dict[str, str] | os._Environ) -> R2Config | None:
    values = [env.get(name, "") for name in R2_ENV]
    return R2Config(*values) if all(values) else None


@dataclass
class TilesObject:
    status: int
    headers: dict[str, str]
    body: Iterator[bytes]


class TilesSource(Protocol):
    def fetch(self, range_header: str | None, head: bool) -> TilesObject: ...


def hmac_sha256(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def signed_headers(cfg: R2Config, method: str, now: dt.datetime) -> dict[str, str]:
    """SigV4 for GET/HEAD without a body: sign only host and x-amz-*."""
    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    day = stamp[:8]
    payload_hash = hashlib.sha256(b"").hexdigest()
    path = f"/{cfg.bucket}/{cfg.key}"
    headers = {"host": cfg.host, "x-amz-content-sha256": payload_hash, "x-amz-date": stamp}
    names = ";".join(sorted(headers))
    canonical = "\n".join(
        [method, path, "", *(f"{k}:{headers[k]}" for k in sorted(headers)), "", names, payload_hash]
    )
    scope = f"{day}/auto/s3/aws4_request"
    to_sign = "\n".join(["AWS4-HMAC-SHA256", stamp, scope, hashlib.sha256(canonical.encode()).hexdigest()])
    k = hmac_sha256(f"AWS4{cfg.secret_access_key}".encode(), day)
    for part in ("auto", "s3", "aws4_request"):
        k = hmac_sha256(k, part)
    signature = hmac.new(k, to_sign.encode(), hashlib.sha256).hexdigest()
    headers["authorization"] = (
        f"AWS4-HMAC-SHA256 Credential={cfg.access_key_id}/{scope}, "
        f"SignedHeaders={names}, Signature={signature}"
    )
    return headers


class R2Source:
    def __init__(self, cfg: R2Config) -> None:
        self.cfg = cfg

    def fetch(self, range_header: str | None, head: bool) -> TilesObject:
        method = "HEAD" if head else "GET"
        headers = signed_headers(self.cfg, method, dt.datetime.now(dt.UTC))
        if range_header:
            headers["range"] = range_header
        url = f"https://{self.cfg.host}/{self.cfg.bucket}/{self.cfg.key}"
        req = urllib.request.Request(url, headers=headers, method=method)
        try:
            resp = urllib.request.urlopen(req, timeout=30)
        except urllib.error.HTTPError as e:
            # 416 and 404 are passed through as is; anything else (403 etc.) is our fault, not the client's.
            if e.code in (404, 416):
                return TilesObject(e.code, {}, iter(()))
            raise
        kept = {k: v for k, v in resp.headers.items() if k.lower() in PASSTHROUGH}
        body = iter(()) if head else iter(lambda: resp.read(CHUNK), b"")
        return TilesObject(resp.status, kept, body)


def tiles_endpoint(source: TilesSource | None) -> Callable[[Request], Awaitable[Response]]:
    async def endpoint(request: Request) -> Response:
        if source is None:
            return PlainTextResponse("map tiles storage is not configured", status_code=503)
        head = request.method == "HEAD"
        # Conditional headers are not forwarded: 304 instead of 206 breaks pmtiles (see site.py).
        obj = await run_in_threadpool(source.fetch, request.headers.get("range"), head)
        if obj.status in (404, 416):
            text = "not found" if obj.status == 404 else "range not satisfiable"
            return PlainTextResponse(text, obj.status)
        headers = {**obj.headers, "Accept-Ranges": "bytes", "Cache-Control": TILES_CACHE}
        headers.setdefault("Content-Type", "application/octet-stream")
        return StreamingResponse(iterate_in_threadpool(obj.body), status_code=obj.status, headers=headers)

    return endpoint

