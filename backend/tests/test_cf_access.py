import base64
import hashlib
import json
import random

import pytest
from starlette.testclient import TestClient

from alta_feedback.cf_access import (
    SHA256_PREFIX,
    AccessConfig,
    AccessKeys,
    RsaKey,
    admin_email,
    config_from_env,
    verify_token,
)
from alta_feedback.main import create_app

NOW = 1_800_000_000
TEAM = "example-team.cloudflareaccess.com"
AUD = "aud-of-the-admin-app"
ADMIN = "admin@example.com"
CONFIG = AccessConfig(TEAM, AUD, frozenset({ADMIN}))
TOKEN = "admin-secret"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


def is_probable_prime(n: int, rng: random.Random) -> bool:
    if n % 2 == 0:
        return False
    d, r = n - 1, 0
    while d % 2 == 0:
        d, r = d // 2, r + 1
    for _ in range(20):
        x = pow(rng.randrange(2, n - 1), d, n)
        if x in (1, n - 1):
            continue
        for _ in range(r - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def prime(bits: int, rng: random.Random) -> int:
    while True:
        candidate = rng.getrandbits(bits) | (1 << (bits - 1)) | 1
        if is_probable_prime(candidate, rng):
            return candidate


def new_key(seed: int) -> tuple[RsaKey, int]:
    """Тестовая пара RSA-1024: открытый ключ и закрытая экспонента."""
    rng = random.Random(seed)
    while True:
        p, q = prime(512, rng), prime(512, rng)
        phi = (p - 1) * (q - 1)
        try:
            return RsaKey(p * q, 65537), pow(65537, -1, phi)
        except ValueError:
            continue


KEY, SECRET = new_key(1)
OTHER_KEY, OTHER_SECRET = new_key(2)


def b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def sign(message: bytes, key: RsaKey, secret: int) -> bytes:
    size = (key.n.bit_length() + 7) // 8
    digest = SHA256_PREFIX + hashlib.sha256(message).digest()
    encoded = b"\x00\x01" + b"\xff" * (size - 3 - len(digest)) + b"\x00" + digest
    return pow(int.from_bytes(encoded, "big"), secret, key.n).to_bytes(size, "big")


def make_token(
    key: RsaKey = KEY, secret: int = SECRET, kid: str = "k1", alg: str = "RS256", **claims
) -> str:
    body = {"aud": [AUD], "iss": f"https://{TEAM}", "email": ADMIN, "exp": NOW + 600, "nbf": NOW - 5,
            **claims}
    head = b64(json.dumps({"alg": alg, "kid": kid}).encode())
    payload = b64(json.dumps(body).encode())
    return f"{head}.{payload}.{b64(sign(f'{head}.{payload}'.encode(), key, secret))}"


def jwks(**keys: RsaKey) -> bytes:
    def enc(value: int) -> str:
        return b64(value.to_bytes((value.bit_length() + 7) // 8, "big"))

    return json.dumps({"keys": [
        {"kid": kid, "kty": "RSA", "alg": "RS256", "n": enc(k.n), "e": enc(k.e)} for kid, k in keys.items()
    ]}).encode()


def keys_from(raw: bytes, clock=lambda: NOW) -> AccessKeys:
    return AccessKeys(CONFIG.certs_url, fetch=lambda url: raw, clock=clock)


def test_valid_token_gives_admin_email():
    assert admin_email(make_token(), CONFIG, keys_from(jwks(k1=KEY)), NOW) == ADMIN


def test_token_signed_by_foreign_key_is_rejected():
    forged = make_token(key=OTHER_KEY, secret=OTHER_SECRET)
    assert admin_email(forged, CONFIG, keys_from(jwks(k1=KEY)), NOW) is None


def test_tampered_payload_is_rejected():
    head, _, signature = make_token().split(".")
    payload = b64(json.dumps({"aud": [AUD], "iss": f"https://{TEAM}", "email": "x@example.com",
                              "exp": NOW + 600}).encode())
    assert admin_email(f"{head}.{payload}.{signature}", CONFIG, keys_from(jwks(k1=KEY)), NOW) is None


def test_token_of_another_access_app_is_rejected():
    token = make_token(aud=["aud-of-some-other-app"])
    assert admin_email(token, CONFIG, keys_from(jwks(k1=KEY)), NOW) is None


def test_token_from_another_team_is_rejected():
    token = make_token(iss="https://other-team.cloudflareaccess.com")
    assert admin_email(token, CONFIG, keys_from(jwks(k1=KEY)), NOW) is None


def test_expired_token_is_rejected():
    assert admin_email(make_token(exp=NOW - 3600), CONFIG, keys_from(jwks(k1=KEY)), NOW) is None


def test_unsigned_token_is_rejected():
    head = b64(json.dumps({"alg": "none", "kid": "k1"}).encode())
    payload = make_token().split(".")[1]
    assert admin_email(f"{head}.{payload}.", CONFIG, keys_from(jwks(k1=KEY)), NOW) is None


def test_valid_token_of_non_admin_is_rejected():
    token = make_token(email="stranger@example.com")
    assert admin_email(token, CONFIG, keys_from(jwks(k1=KEY)), NOW) is None


def test_email_is_compared_case_insensitively():
    token = make_token(email="Admin@Example.com")
    assert admin_email(token, CONFIG, keys_from(jwks(k1=KEY)), NOW) == ADMIN


@pytest.mark.parametrize("token", ["", "abc", "a.b.c", "....", "e30.e30.!!"])
def test_garbage_token_is_rejected(token):
    assert admin_email(token, CONFIG, keys_from(jwks(k1=KEY)), NOW) is None


def test_rotated_key_is_picked_up_without_waiting_for_cache_expiry():
    served = [jwks(k1=KEY)]
    clock = [NOW]
    keys = AccessKeys(CONFIG.certs_url, fetch=lambda url: served[0], clock=lambda: clock[0])
    keys.get("k1")
    served[0] = jwks(k2=OTHER_KEY)
    clock[0] += 120
    token = make_token(key=OTHER_KEY, secret=OTHER_SECRET, kid="k2")
    assert admin_email(token, CONFIG, keys, clock[0]) == ADMIN


def test_unreachable_certs_keep_previous_keys():
    calls = []

    def fetch(url: str) -> bytes:
        calls.append(url)
        if len(calls) > 1:
            raise OSError("down")
        return jwks(k1=KEY)

    clock = [NOW]
    keys = AccessKeys(CONFIG.certs_url, fetch=fetch, clock=lambda: clock[0])
    keys.get("k1")
    clock[0] += 7200
    assert admin_email(make_token(exp=NOW + 9000), CONFIG, keys, clock[0]) == ADMIN


def test_verify_token_needs_known_kid():
    with pytest.raises(Exception, match="unknown_kid"):
        verify_token(make_token(kid="nope"), {"k1": KEY}, CONFIG, NOW)


@pytest.mark.parametrize("missing", ["CF_ACCESS_TEAM_DOMAIN", "CF_ACCESS_AUD", "ADMIN_EMAILS"])
def test_empty_env_value_turns_access_off(missing):
    env = {"CF_ACCESS_TEAM_DOMAIN": TEAM, "CF_ACCESS_AUD": AUD, "ADMIN_EMAILS": ADMIN}
    assert config_from_env({**env, missing: ""}) is None


def test_access_works_from_defaults_without_env():
    """Деплой не кладёт настройки Access в .env — без значений по умолчанию админка была бы без входа."""
    assert config_from_env({}) is not None


def test_env_overrides_default():
    defaults = {"CF_ACCESS_TEAM_DOMAIN": TEAM, "CF_ACCESS_AUD": AUD, "ADMIN_EMAILS": ADMIN}
    config = config_from_env({"ADMIN_EMAILS": "other@example.com"}, defaults)
    assert config == AccessConfig(TEAM, AUD, frozenset({"other@example.com"}))


def test_admin_list_from_env_is_split_and_lowercased():
    env = {"CF_ACCESS_TEAM_DOMAIN": f"https://{TEAM}/", "CF_ACCESS_AUD": AUD,
           "ADMIN_EMAILS": " A@example.com, b@example.com ,"}
    assert config_from_env(env) == AccessConfig(TEAM, AUD, frozenset({"a@example.com", "b@example.com"}))


@pytest.fixture
def client(tmp_path) -> TestClient:
    keys = keys_from(jwks(k1=KEY), clock=lambda: NOW)
    app = create_app(data_dir=tmp_path, admin_token=TOKEN, ip_salt="salt", access=CONFIG, access_keys=keys)
    return TestClient(app)


def access(token: str) -> dict[str, str]:
    return {"Cf-Access-Jwt-Assertion": token}


def test_access_session_opens_proposals_list(client):
    assert client.get("/admin/proposals", headers=access(make_token())).status_code == 200


def test_access_session_can_edit_proposal(client):
    response = client.post("/admin/proposals/1", json={"status": "rejected"}, headers=access(make_token()))
    assert response.status_code == 404


def test_forged_access_token_gets_401(client):
    forged = make_token(key=OTHER_KEY, secret=OTHER_SECRET)
    assert client.get("/admin/proposals", headers=access(forged)).status_code == 401


def test_non_admin_access_session_gets_401(client):
    token = make_token(email="stranger@example.com")
    assert client.get("/admin/proposals", headers=access(token)).status_code == 401


def test_bearer_still_opens_proposals(client):
    assert client.get("/admin/proposals", headers=AUTH).status_code == 200


def test_monitor_lists_new_account_reports_by_bearer(client):
    assert client.get("/admin/accounts", params={"status": "new"}, headers=AUTH).status_code == 200


def test_monitor_sets_account_status_by_bearer(client):
    response = client.post("/admin/accounts/999/status", json={"status": "accepted"}, headers=AUTH)
    assert response.status_code == 404


def test_access_token_does_not_open_account_reports(client):
    """Access стоит только перед админкой предложений; отчёты о счетах — по-прежнему только Bearer."""
    assert client.get("/admin/accounts", headers=access(make_token())).status_code == 401


def test_without_access_config_jwt_is_ignored(tmp_path, monkeypatch):
    monkeypatch.setenv("CF_ACCESS_AUD", "")
    client = TestClient(create_app(data_dir=tmp_path, admin_token=TOKEN, ip_salt="salt"))
    assert client.get("/admin/proposals", headers=access(make_token())).status_code == 401


def test_admin_page_has_no_token_field_by_default(tmp_path):
    client = TestClient(create_app(data_dir=tmp_path, admin_token=TOKEN, ip_salt="salt"))
    assert 'type="password"' not in client.get("/predlozheniya/admin/").text


def test_admin_page_has_no_token_field_behind_access(client):
    assert 'type="password"' not in client.get("/predlozheniya/admin/").text


def test_admin_page_shows_token_field_when_access_is_off(tmp_path, monkeypatch):
    """С выключенным Access без поля токена в админку было бы не войти."""
    monkeypatch.setenv("CF_ACCESS_AUD", "")
    client = TestClient(create_app(data_dir=tmp_path, admin_token=TOKEN, ip_salt="salt"))
    assert 'type="password"' in client.get("/predlozheniya/admin/").text
