"""Admin proposals login through Cloudflare Access: verifies the JWT from `Cf-Access-Jwt-Assertion`.

Access itself lets only the owner onto the page; the service checks the token signature, its
`aud` and `iss` again and matches the email against its own admin list, so a request bypassing the
tunnel fails.
"""

import base64
import binascii
import hashlib
import hmac
import json
import time
import urllib.request
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field

HEADER = "cf-access-jwt-assertion"
KEYS_TTL = 3600
# An unknown kid after key rotation is a reason to refetch the key list, but not more than once a minute.
KEYS_RETRY = 60
LEEWAY = 60
# DigestInfo SHA-256 from RFC 8017, 9.2: compare the signature with the full expected record instead of
# parsing it,
# so forgeries with garbage in the ASN.1 parse do not pass.
SHA256_PREFIX = bytes.fromhex("3031300d060960864801650304020105000420")
# Defaults are not secrets: the Zero Trust team domain, the alta-admin app aud and the admin email.
# An environment variable overrides the value; an empty one disables Access login.
DEFAULTS = {
    "CF_ACCESS_TEAM_DOMAIN": "sparkling-pine-a39b.cloudflareaccess.com",
    "CF_ACCESS_AUD": "9578f393790da8c36a371e9ade797bcb2e68684d9fb68952fd2a486dc2248ba2",
    "ADMIN_EMAILS": "smolevich90@gmail.com",
}


class AccessError(Exception):
    """The token failed verification."""


@dataclass(frozen=True)
class RsaKey:
    n: int
    e: int


@dataclass(frozen=True)
class AccessConfig:
    team_domain: str
    aud: str
    admins: frozenset[str]

    @property
    def issuer(self) -> str:
        return f"https://{self.team_domain}"

    @property
    def certs_url(self) -> str:
        return f"{self.issuer}/cdn-cgi/access/certs"


def config_from_env(env: Mapping[str, str], defaults: Mapping[str, str] = DEFAULTS) -> AccessConfig | None:
    """Without a team domain, aud or at least one admin, Access login is disabled."""
    def get(name: str) -> str:
        return env.get(name, defaults.get(name, "")).strip()

    team = get("CF_ACCESS_TEAM_DOMAIN").removeprefix("https://").rstrip("/")
    aud = get("CF_ACCESS_AUD")
    admins = frozenset(e.strip().lower() for e in get("ADMIN_EMAILS").split(",") if e.strip())
    return AccessConfig(team, aud, admins) if team and aud and admins else None


def b64url(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def to_int(text: str) -> int:
    return int.from_bytes(b64url(text), "big")


def parse_keys(raw: bytes) -> dict[str, RsaKey]:
    """Cloudflare JWKS -> RS256 keys by kid."""
    keys = json.loads(raw).get("keys", [])
    return {
        k["kid"]: RsaKey(to_int(k["n"]), to_int(k["e"]))
        for k in keys
        if k.get("kty") == "RSA" and k.get("kid") and k.get("n") and k.get("e")
    }


def rs256_valid(message: bytes, signature: bytes, key: RsaKey) -> bool:
    size = (key.n.bit_length() + 7) // 8
    if len(signature) != size or int.from_bytes(signature, "big") >= key.n:
        return False
    padding = size - 3 - len(SHA256_PREFIX) - hashlib.sha256().digest_size
    if padding < 8:
        return False
    decoded = pow(int.from_bytes(signature, "big"), key.e, key.n).to_bytes(size, "big")
    expected = b"\x00\x01" + b"\xff" * padding + b"\x00" + SHA256_PREFIX + hashlib.sha256(message).digest()
    return hmac.compare_digest(decoded, expected)


def split_token(token: str) -> tuple[dict, dict, bytes, bytes]:
    parts = token.split(".")
    if len(parts) != 3:
        raise AccessError("malformed")
    try:
        header, claims = json.loads(b64url(parts[0])), json.loads(b64url(parts[1]))
        signature = b64url(parts[2])
    except (binascii.Error, ValueError) as e:
        raise AccessError("malformed") from e
    if not isinstance(header, dict) or not isinstance(claims, dict):
        raise AccessError("malformed")
    return header, claims, f"{parts[0]}.{parts[1]}".encode(), signature


def check_claims(claims: dict, config: AccessConfig, now: float) -> str:
    aud = claims.get("aud")
    if config.aud not in (aud if isinstance(aud, list) else [aud]):
        raise AccessError("aud")
    if claims.get("iss") != config.issuer:
        raise AccessError("iss")
    exp, nbf = claims.get("exp"), claims.get("nbf", 0)
    if not isinstance(exp, int | float) or exp + LEEWAY < now:
        raise AccessError("expired")
    if not isinstance(nbf, int | float) or nbf - LEEWAY > now:
        raise AccessError("not_yet_valid")
    email = claims.get("email")
    if not isinstance(email, str) or not email:
        raise AccessError("no_email")
    return email.lower()


def verify_token(token: str, keys: Mapping[str, RsaKey], config: AccessConfig, now: float) -> str:
    """Returns the email from a verified Access token."""
    header, claims, signed, signature = split_token(token)
    if header.get("alg") != "RS256":
        raise AccessError("alg")
    key = keys.get(header.get("kid", ""))
    if key is None:
        raise AccessError("unknown_kid")
    if not rs256_valid(signed, signature, key):
        raise AccessError("bad_signature")
    return check_claims(claims, config, now)


def kid_of(token: str) -> str:
    try:
        return split_token(token)[0].get("kid", "")
    except AccessError:
        return ""


def fetch_url(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=5) as response:
        return response.read()


@dataclass
class AccessKeys:
    """The team's Access public keys, cached: refetched on expiry or on a new kid."""

    url: str
    fetch: Callable[[str], bytes] = fetch_url
    clock: Callable[[], float] = time.time
    keys: dict[str, RsaKey] = field(default_factory=dict)
    fetched_at: float = float("-inf")

    def get(self, kid: str) -> dict[str, RsaKey]:
        now = self.clock()
        stale = now - self.fetched_at > KEYS_TTL
        unknown = kid not in self.keys and now - self.fetched_at > KEYS_RETRY
        if stale or unknown:
            try:
                self.keys = parse_keys(self.fetch(self.url))
            except (OSError, ValueError, KeyError):
                pass
            self.fetched_at = now
        return self.keys


def admin_email(token: str, config: AccessConfig, keys: AccessKeys, now: float) -> str | None:
    """Admin email from the token, otherwise None (signature, expiry, aud, or an email not on the list)."""
    try:
        email = verify_token(token, keys.get(kid_of(token)), config, now)
    except AccessError:
        return None
    return email if email in config.admins else None
