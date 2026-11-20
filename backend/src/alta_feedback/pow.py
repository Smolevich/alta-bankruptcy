"""Proof-of-work against bots in ALTCHA format: the challenge is signed with HMAC, the browser searches
for the solution.

The server picks a number n and returns sha256(salt + n), the salt and a signature. The browser tries
numbers until one matches. No state: everything needed for verification is in the signed challenge,
reuse is caught by the store keyed on the challenge itself.
"""

import base64
import binascii
import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

ALGORITHM = "SHA-256"
CHALLENGE_TTL = timedelta(minutes=30)


@dataclass(frozen=True)
class Challenge:
    algorithm: str
    challenge: str
    salt: str
    signature: str
    maxnumber: int


@dataclass(frozen=True)
class Solved:
    challenge: str
    expires_at: int


def derive_key(secret: str) -> bytes:
    """Signing key derived from an existing secret, so no new one has to be created in Vault."""
    return hashlib.sha256(f"altcha-pow:{secret}".encode()).digest()


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def sign(key: bytes, challenge: str) -> str:
    return hmac.new(key, challenge.encode(), hashlib.sha256).hexdigest()


def create_challenge(key: bytes, now: datetime, maxnumber: int, number: int | None = None) -> Challenge:
    """New challenge; the expiry is baked into the salt and so is also signed."""
    expires = int((now + CHALLENGE_TTL).timestamp())
    salt = f"{secrets.token_hex(12)}?expires={expires}"
    secret_number = secrets.randbelow(maxnumber + 1) if number is None else number
    challenge = sha256_hex(f"{salt}{secret_number}")
    return Challenge(ALGORITHM, challenge, salt, sign(key, challenge), maxnumber)


def solve(challenge: Challenge) -> int | None:
    """Brute force as in the browser; needed by tests."""
    for number in range(challenge.maxnumber + 1):
        if sha256_hex(f"{challenge.salt}{number}") == challenge.challenge:
            return number
    return None


def encode_payload(challenge: Challenge, number: int) -> str:
    body = {
        "algorithm": challenge.algorithm, "challenge": challenge.challenge, "number": number,
        "salt": challenge.salt, "signature": challenge.signature,
    }
    return base64.b64encode(json.dumps(body).encode()).decode()


def expires_at(salt: str) -> int | None:
    _, _, query = salt.partition("?")
    for part in query.split("&"):
        name, _, value = part.partition("=")
        if name == "expires" and value.isdigit():
            return int(value)
    return None


def verify_payload(key: bytes, payload: str, now: datetime) -> Solved | None:
    """Verifies the solution; returns the challenge and its expiry (for replay tracking) or None."""
    try:
        data = json.loads(base64.b64decode(payload, validate=True))
        algorithm, challenge, salt = data["algorithm"], data["challenge"], data["salt"]
        number, signature = int(data["number"]), data["signature"]
    except (binascii.Error, ValueError, KeyError, TypeError):
        return None
    if algorithm != ALGORITHM or not all(isinstance(v, str) for v in (challenge, salt, signature)):
        return None
    expires = expires_at(salt)
    if expires is None or expires < now.timestamp():
        return None
    if not hmac.compare_digest(sign(key, challenge), signature):
        return None
    if not hmac.compare_digest(sha256_hex(f"{salt}{number}"), challenge):
        return None
    return Solved(challenge, expires)
