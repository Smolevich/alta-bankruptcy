import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from starlette.testclient import TestClient

from alta_feedback import queues
from alta_feedback.main import create_app

TOKEN = "admin-secret"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
SITE_LIST = Path(__file__).parents[2] / "src/data/postanska-branches.json"


@pytest.fixture
def client(tmp_path) -> TestClient:
    return TestClient(create_app(data_dir=tmp_path, admin_token=TOKEN, ip_salt="salt"))


def mark(client: TestClient, ip: str = "203.0.113.5", **fields):
    body = {"branch_id": "715", "state": "outside", **fields}
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


def test_hourly_limit_across_branches(client):
    ids = sorted(queues.branch_ids())[: queues.PER_HOUR_LIMIT + 1]
    codes = [mark(client, branch_id=i).status_code for i in ids]
    assert codes[-1] == 429


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

