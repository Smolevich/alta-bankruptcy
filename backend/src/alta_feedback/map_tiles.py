"""Подложка карты отделений: /map/serbia.pmtiles отдаём из бакета R2, а не из git.

Файл весит ~50 МБ и не должен жить в репозитории. Сервис ходит в R2 по S3 API (подпись SigV4,
только стандартная библиотека) и пробрасывает Range, потому что pmtiles в браузере читает
файл кусками. Ключи приходят из окружения (.env, который деплой собирает из Vault).
"""

import datetime as dt
import hashlib
import hmac
import os
import urllib.error
import urllib.request
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol

from starlette.concurrency import iterate_in_threadpool, run_in_threadpool
from starlette.requests import Request
from starlette.responses import PlainTextResponse, Response, StreamingResponse

# Cloudflare кэширует по расширению файла, а .pmtiles в его списке нет: без правила кэша на
# зоне заголовок ничего не даст. Сутки: подмена файла под тем же именем потребует purge.
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


def _sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def signed_headers(cfg: R2Config, method: str, now: dt.datetime) -> dict[str, str]:
    """SigV4 для GET/HEAD без тела: подписываем только host и x-amz-*."""
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
    k = _sign(f"AWS4{cfg.secret_access_key}".encode(), day)
    for part in ("auto", "s3", "aws4_request"):
        k = _sign(k, part)
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
            # 416 и 404 отдаём как есть, остальное (403 и т. п.) — наша поломка, а не клиента.
            if e.code in (404, 416):
                return TilesObject(e.code, {}, iter(()))
            raise
        kept = {k: v for k, v in resp.headers.items() if k.lower() in PASSTHROUGH}
        body = iter(()) if head else iter(lambda: resp.read(CHUNK), b"")
        return TilesObject(resp.status, kept, body)


def tiles_endpoint(source: TilesSource | None):
    async def endpoint(request: Request) -> Response:
        if source is None:
            return PlainTextResponse("map tiles storage is not configured", status_code=503)
        head = request.method == "HEAD"
        # Условные заголовки не пробрасываем: 304 вместо 206 ломает pmtiles (см. site.py).
        obj = await run_in_threadpool(source.fetch, request.headers.get("range"), head)
        if obj.status in (404, 416):
            text = "not found" if obj.status == 404 else "range not satisfiable"
            return PlainTextResponse(text, obj.status)
        headers = {**obj.headers, "Accept-Ranges": "bytes", "Cache-Control": TILES_CACHE}
        headers.setdefault("Content-Type", "application/octet-stream")
        return StreamingResponse(iterate_in_threadpool(obj.body), status_code=obj.status, headers=headers)

    return endpoint

