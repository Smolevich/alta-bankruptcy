import datetime as dt

import pytest
from starlette.testclient import TestClient

from alta_feedback.main import create_app
from alta_feedback.map_tiles import R2_ENV, R2Config, TilesObject, signed_headers

DATA = bytes(range(256))


class FakeBucket:
    """Граница с R2: ведёт себя как S3 — 200 на целый файл, 206 на Range, 416 за краем."""

    def __init__(self) -> None:
        self.ranges: list[str | None] = []

    def fetch(self, range_header: str | None, head: bool) -> TilesObject:
        self.ranges.append(range_header)
        headers = {"ETag": '"abc"', "Content-Type": "application/octet-stream"}
        if range_header is None:
            body = DATA
            headers["Content-Length"] = str(len(body))
            return TilesObject(200, headers, iter([b"" if head else body]))
        start, end = (int(x) for x in range_header.removeprefix("bytes=").split("-"))
        if start >= len(DATA):
            return TilesObject(416, {}, iter(()))
        body = DATA[start : end + 1]
        headers |= {"Content-Length": str(len(body)), "Content-Range": f"bytes {start}-{end}/{len(DATA)}"}
        return TilesObject(206, headers, iter([b"" if head else body]))


@pytest.fixture
def bucket() -> FakeBucket:
    return FakeBucket()


@pytest.fixture
def client(tmp_path, bucket) -> TestClient:
    app = create_app(
        data_dir=tmp_path / "data", admin_token="t", ip_salt="salt", site_dir=tmp_path, tiles=bucket
    )
    return TestClient(app)


def test_range_request_gets_206_with_exact_bytes(client, bucket):
    response = client.get("/map/serbia.pmtiles", headers={"Range": "bytes=10-19"})
    assert response.status_code == 206
    assert response.content == DATA[10:20]
    assert response.headers["content-range"] == "bytes 10-19/256"
    assert response.headers["accept-ranges"] == "bytes"
    assert bucket.ranges == ["bytes=10-19"]


def test_full_request_streams_whole_file_and_is_cacheable(client):
    response = client.get("/map/serbia.pmtiles")
    assert response.status_code == 200
    assert response.content == DATA
    assert "max-age=" in response.headers["cache-control"]
    assert response.headers["etag"] == '"abc"'


def test_range_with_if_none_match_still_gets_206(client):
    # pmtiles у повторного посетителя шлёт If-None-Match вместе с Range; 304 ломает чтение.
    response = client.get("/map/serbia.pmtiles", headers={"Range": "bytes=0-3", "If-None-Match": '"abc"'})
    assert response.status_code == 206
    assert response.content == DATA[:4]


def test_range_past_the_end_is_416(client):
    assert client.get("/map/serbia.pmtiles", headers={"Range": "bytes=999-1000"}).status_code == 416


def test_head_has_headers_and_no_body(client):
    response = client.head("/map/serbia.pmtiles")
    assert response.status_code == 200
    assert response.content == b""
    assert response.headers["accept-ranges"] == "bytes"


def test_without_storage_config_answers_503_not_a_wrong_map(tmp_path, monkeypatch):
    for name in R2_ENV:
        monkeypatch.delenv(name, raising=False)
    app = create_app(data_dir=tmp_path / "data", admin_token="t", ip_salt="salt", site_dir=tmp_path)
    assert TestClient(app).get("/map/serbia.pmtiles").status_code == 503


def test_signature_depends_on_secret_and_has_sigv4_shape():
    # Подлинность подписи проверяет только сам R2 (см. PR), здесь — форма и зависимость от секрета.
    cfg = R2Config("acc", "AKID", "secret", "bkt", "k.pmtiles")
    now = dt.datetime(2026, 11, 7, 12, 0, 0, tzinfo=dt.UTC)
    a = signed_headers(cfg, "GET", now)
    assert a == signed_headers(cfg, "GET", now)
    assert a != signed_headers(R2Config("acc", "AKID", "other", "bkt", "k.pmtiles"), "GET", now)
    assert a["authorization"].startswith("AWS4-HMAC-SHA256 Credential=AKID/20261107/auto/s3/aws4_request")
    assert a["host"] == "acc.r2.cloudflarestorage.com"
