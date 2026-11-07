import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from starlette.testclient import TestClient

from alta_feedback import queues
from alta_feedback.main import create_app
from alta_feedback.pow import Challenge, encode_payload, solve
from alta_feedback.validate import hash_ip

TOKEN = "admin-secret"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
SITE_LIST = Path(__file__).parents[2] / "src/data/postanska-branches.json"
# Среда 11.11.2026, 10:00 по Белграду: отделения открыты, отметки принимаются.
OPEN_NOW = datetime(2026, 11, 11, 9, tzinfo=UTC)


@pytest.fixture
def client(tmp_path) -> TestClient:
    return TestClient(create_app(
        data_dir=tmp_path, admin_token=TOKEN, ip_salt="salt", pow_max_number=50, clock=lambda: OPEN_NOW
    ))


def solved_pow(client: TestClient) -> str:
    data = client.get("/account/challenge").json()
    fields = ("algorithm", "challenge", "salt", "signature")
    challenge = Challenge(*(data[k] for k in fields), data["maxnumber"])
    return encode_payload(challenge, solve(challenge))


def mark(client: TestClient, ip: str = "203.0.113.5", **fields):
    body = {"branch_id": "715", "state": "outside", "altcha": solved_pow(client), **fields}
    return client.post("/api/queue", json=body, headers={"CF-Connecting-IP": ip})


def public(client: TestClient) -> dict:
    return client.get("/api/queue").json()["branches"]


def test_mark_shows_on_map_with_count(client):
    mark(client)
    assert public(client)["715"] | {"minutes_ago": 0} == {"state": "outside", "count": 1, "minutes_ago": 0}


def test_unknown_branch_is_rejected(client):
    assert mark(client, branch_id="99999").status_code == 400


def test_unknown_state_is_rejected(client):
    assert mark(client, state="87").status_code == 400


def test_comment_with_phone_is_rejected(client):
    assert mark(client, comment="звоните +381 64 123 4567").status_code == 400


def test_comment_with_email_is_rejected(client):
    assert mark(client, comment="пишите a@b.rs").status_code == 400


def test_comment_is_not_public(client):
    mark(client, comment="очередь до угла")
    assert "очередь до угла" not in client.get("/api/queue").text


def test_second_mark_for_same_branch_within_15_minutes_is_refused(client):
    mark(client)
    assert mark(client, state="none").status_code == 429


def test_other_visitor_can_mark_same_branch(client):
    mark(client)
    assert mark(client, ip="198.51.100.9", state="full").status_code == 201


def fill_hour(client: TestClient, count: int, ip: str = "203.0.113.5") -> None:
    """Отметки с одного адреса 20–50 минут назад: старше запрета на то же отделение, внутри часа."""
    store = client.app.state.store
    ip_hash = hash_ip(ip, "salt")
    ids = sorted(queues.branch_ids() - {"715"})
    now = datetime.now(UTC)
    for n in range(count):
        report = queues.QueueReport(ids[n % len(ids)], "few", "")
        store.add_queue_report(report, ip_hash, "test", now - timedelta(minutes=20 + n % 30))


def test_shared_network_can_mark_sixty_times_an_hour(client):
    fill_hour(client, 59)
    assert mark(client).status_code == 201


def test_sixty_first_mark_from_one_network_is_refused(client):
    fill_hour(client, 60)
    assert mark(client).json() == {"error": "rate_limit", "scope": "ip"}


def test_same_branch_limit_says_branch(client):
    mark(client)
    assert mark(client, state="none").json()["scope"] == "branch"


def test_mark_without_pow_is_refused(client):
    assert mark(client, altcha="").status_code == 400


def test_mark_with_wrong_pow_number_is_refused(client):
    data = client.get("/account/challenge").json()
    fields = ("algorithm", "challenge", "salt", "signature")
    challenge = Challenge(*(data[k] for k in fields), data["maxnumber"])
    wrong = (solve(challenge) + 1) % (challenge.maxnumber + 1)
    assert mark(client, altcha=encode_payload(challenge, wrong)).status_code == 400


def test_pow_solution_works_only_once(client):
    payload = solved_pow(client)
    mark(client, altcha=payload)
    assert mark(client, ip="198.51.100.9", altcha=payload).status_code == 400


def test_refused_mark_does_not_reach_map(client):
    mark(client, altcha="")
    assert public(client) == {}


def test_public_queue_is_cached_for_30_seconds(client):
    assert client.get("/api/queue").headers["cache-control"] == "public, max-age=30"


def test_raw_ip_is_not_stored(client):
    mark(client, ip="198.51.100.77")
    items = client.get("/admin/queue", params={"since": "2000-01-01T00:00:00Z"}, headers=AUTH).json()["items"]
    assert "198.51.100.77" not in str(items)


def test_spam_mark_disappears_from_map(client):
    mark(client)
    client.post("/admin/queue/1/status", json={"status": "spam"}, headers=AUTH)
    assert public(client) == {}


def test_most_frequent_state_wins():
    now = datetime(2026, 11, 7, 12, tzinfo=UTC)
    at = lambda m: (now - timedelta(minutes=m)).strftime("%Y-%m-%dT%H:%M:%SZ")  # noqa: E731
    rows = [("715", "full", at(50)), ("715", "full", at(30)), ("715", "none", at(5))]
    assert queues.summarize(rows, now)["715"] == {"state": "full", "count": 3, "minutes_ago": 5}


def test_tie_goes_to_latest_state():
    now = datetime(2026, 11, 7, 12, tzinfo=UTC)
    rows = [("715", "full", "2026-11-07T11:00:00Z"), ("715", "none", "2026-11-07T11:30:00Z")]
    assert queues.summarize(rows, now)["715"]["state"] == "none"


def test_backend_branch_list_matches_site_list():
    site = json.loads(SITE_LIST.read_text("utf-8"))
    ids = {site["specijalizovana"]["sifra"], *(b["sifra"] for b in site["ekspoziture"])}
    assert queues.branch_ids() == ids



def test_branch_hours_copy_matches_site_list():
    site = json.loads(SITE_LIST.read_text("utf-8"))
    rows = [site["specijalizovana"], *site["ekspoziture"]]
    hours = queues.parse_hours
    expected = {b["sifra"]: (hours(b["radnoVremeRadnimDanom"]), hours(b["radnoVremeSubotom"])) for b in rows}
    assert queues.branch_hours() == expected


def test_closed_branch_refuses_mark_and_stores_nothing(tmp_path):
    closed_at = datetime(2026, 11, 7, 17, 30, tzinfo=UTC)  # суббота 18:30 по Белграду
    client = TestClient(create_app(
        data_dir=tmp_path, admin_token=TOKEN, ip_salt="salt", pow_max_number=50, clock=lambda: closed_at
    ))
    response = mark(client, branch_id="754")
    closed = {"error": "closed", "reports_from": "7:00", "days_ahead": 2, "weekday": 0}
    assert (response.status_code, response.json()) == (403, closed)
    items = client.get("/admin/queue", params={"since": "2000-01-01T00:00:00Z"}, headers=AUTH).json()["items"]
    assert items == []
