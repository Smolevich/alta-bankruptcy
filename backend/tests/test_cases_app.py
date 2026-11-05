import html
import io
import re
from datetime import date

import pytest
from PIL import Image
from starlette.testclient import TestClient

from alta_feedback import uploads
from alta_feedback.main import create_app
from alta_feedback.pow import Challenge, encode_payload, solve

TOKEN = "admin-secret"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
FORM = "/predlozheniya/?type=case"
POST = "/predlozheniya/case"


@pytest.fixture
def client(tmp_path) -> TestClient:
    return TestClient(create_app(data_dir=tmp_path, admin_token=TOKEN, ip_salt="salt", pow_max_number=50))


def photo(color: str = "navy", with_gps: bool = True) -> bytes:
    exif = Image.Exif()
    if with_gps:
        exif.get_ifd(0x8825)[2] = (44.0, 49.0, 0.0)
    out = io.BytesIO()
    Image.new("RGB", (60, 40), color).save(out, format="JPEG", exif=exif)
    return out.getvalue()


def solved_pow(client: TestClient) -> str:
    page = client.get(FORM).text

    def attr(name: str) -> str:
        return html.unescape(re.search(rf'data-{name}="([^"]*)"', page).group(1))

    challenge = Challenge(
        attr("algorithm"), attr("challenge"), attr("salt"), attr("signature"), int(attr("maxnumber"))
    )
    return encode_payload(challenge, solve(challenge))


def send_case(
    client: TestClient, files: list[tuple[str, bytes]] | None = None, ip: str = "203.0.113.5",
    altcha: str | None = None, path: str = POST, **fields,
):
    data = {
        "altcha": solved_pow(client) if altcha is None else altcha,
        "category": "property",
        "summary": "Продажа квартиры: деньги покупателя застряли на счёте в ALTA.",
        "filed": "Заявление в AOD о разблокировке",
        "result": "Ответили, что сделку завершат после стечая",
        "event_date": "2026-11-02",
        "sources": "",
        "contact": "@ivan_testov",
        **fields,
    }
    upload = [("files", (name, body, "image/jpeg")) for name, body in (files or [])]
    return client.post(
        path, data=data, files=upload or None, headers={"CF-Connecting-IP": ip}, follow_redirects=False,
    )


def admin_cases(client: TestClient) -> list[dict]:
    return client.get("/admin/proposals/cases", headers=AUTH).json()["items"]


def set_case(client: TestClient, case_id: int, **fields):
    return client.post(f"/admin/proposals/cases/{case_id}", json=fields, headers=AUTH)


def publish_all(client: TestClient, case_id: int = 1) -> None:
    set_case(client, case_id, status="accepted", published=True, files_published=True)


def first_file_name(client: TestClient) -> str:
    return admin_cases(client)[0]["files"][0]["name"]


def test_case_form_opens_without_login(client):
    assert client.get(FORM).status_code == 200


def test_case_form_links_account_opening_to_its_own_form(client):
    assert 'href="/account/stats"' in client.get(FORM).text


def test_case_form_page_may_fetch_fresh_bot_check(client):
    csp = client.get(FORM).headers["content-security-policy"]
    assert "connect-src 'self'" in csp


def test_case_with_two_photos_reaches_admin_with_both(client):
    send_case(client, [("a.jpg", photo()), ("b.jpg", photo("red"))])
    assert len(admin_cases(client)[0]["files"]) == 2


def test_case_redirects_back_to_case_tab_with_its_number(client):
    assert send_case(client).headers["location"] == "/predlozheniya/?type=case&case_sent=1"


def test_case_without_sources_is_accepted(client):
    assert send_case(client, sources="").status_code == 303


def test_material_still_requires_sources(client):
    data = {"title": "Заголовок", "text": "Текст", "sources": "", "target": "site"}
    assert client.post("/predlozheniya/", data=data, follow_redirects=False).status_code == 400


def test_case_without_bot_check_is_not_stored(client):
    send_case(client, altcha="")
    assert admin_cases(client) == []


def test_honeypot_case_is_not_stored(client):
    send_case(client, website="http://spam.example")
    assert admin_cases(client) == []


def test_case_without_result_is_rejected(client):
    assert send_case(client, result=" ").status_code == 400


def test_future_date_is_rejected(client):
    assert send_case(client, event_date=date(2099, 1, 1).isoformat()).status_code == 400


def test_own_page_link_must_be_http(client):
    assert send_case(client, own_url="javascript:alert(1)").status_code == 400


def test_phone_in_summary_is_not_stored(client):
    send_case(client, summary="Звоните мне +381 64 123 4567, расскажу")
    assert "123 4567" not in admin_cases(client)[0]["summary"]


def test_eleven_files_are_rejected(client):
    files = [(f"{n}.jpg", photo()) for n in range(uploads.MAX_FILES + 1)]
    assert send_case(client, files).status_code == 400


def test_file_disguised_as_jpeg_is_rejected(client):
    send_case(client, [("cat.jpg", b"<html><script>alert(1)</script></html>")])
    assert admin_cases(client) == []


def test_file_type_error_names_the_file(client):
    response = send_case(client, [("cat.jpg", b"<html></html>")])
    assert "cat.jpg" in response.text


def test_errors_follow_page_language(client):
    response = send_case(client, path="/en/predlozheniya/case", result="")
    assert "Write the result" in response.text


def test_stored_photo_has_no_location(client):
    send_case(client, [("a.jpg", photo())])
    body = client.get(f"/admin/proposals/cases/files/{first_file_name(client)}", headers=AUTH).content
    assert not Image.open(io.BytesIO(body)).getexif()


def test_sixth_case_in_hour_is_limited(client):
    for _ in range(5):
        send_case(client)
    assert send_case(client).status_code == 429


def test_upload_limit_counts_files_not_cases(client, monkeypatch):
    monkeypatch.setattr(uploads, "FILES_PER_HOUR", 3)
    send_case(client, [("a.jpg", photo()), ("b.jpg", photo())])
    assert send_case(client, [("c.jpg", photo()), ("d.jpg", photo())]).status_code == 429


def test_upload_limit_does_not_block_case_without_files(client, monkeypatch):
    monkeypatch.setattr(uploads, "FILES_PER_HOUR", 1)
    send_case(client, [("a.jpg", photo())])
    assert send_case(client).status_code == 303


def test_body_over_limit_is_refused_before_reading(client):
    headers = {"Content-Length": str(uploads.TOTAL_MAX + 5 * 1024 * 1024)}
    assert client.post(POST, content=b"x", headers=headers).status_code == 413


def test_new_case_file_is_not_public(client):
    send_case(client, [("a.jpg", photo())])
    assert client.get(f"/api/cases/files/{first_file_name(client)}").status_code == 404


def test_accepted_but_unpublished_file_is_not_public(client):
    send_case(client, [("a.jpg", photo())])
    set_case(client, 1, status="accepted", files_published=True)
    assert client.get(f"/api/cases/files/{first_file_name(client)}").status_code == 404


def test_published_case_keeps_files_private_without_their_flag(client):
    send_case(client, [("a.jpg", photo())])
    set_case(client, 1, status="accepted", published=True)
    assert client.get(f"/api/cases/files/{first_file_name(client)}").status_code == 404


def test_published_file_is_served(client):
    send_case(client, [("a.jpg", photo())])
    publish_all(client)
    assert client.get(f"/api/cases/files/{first_file_name(client)}").status_code == 200


def test_unpublished_again_file_is_hidden(client):
    send_case(client, [("a.jpg", photo())])
    publish_all(client)
    set_case(client, 1, published=False)
    assert client.get(f"/api/cases/files/{first_file_name(client)}").status_code == 404


def test_admin_file_requires_token(client):
    send_case(client, [("a.jpg", photo())])
    assert client.get(f"/admin/proposals/cases/files/{first_file_name(client)}").status_code == 401


def test_admin_list_requires_token(client):
    assert client.get("/admin/proposals/cases").status_code == 401


def test_public_feed_hides_new_case(client):
    send_case(client)
    assert client.get("/api/cases/public").json()["items"] == []


def test_public_feed_shows_published_case(client):
    send_case(client)
    set_case(client, 1, status="accepted", published=True)
    assert client.get("/api/cases/public").json()["count"] == 1


def test_public_feed_hides_test_case_even_if_flagged(client):
    send_case(client)
    set_case(client, 1, status="test", published=True)
    assert client.get("/api/cases/public").json()["items"] == []


def test_public_feed_has_no_contact_or_traces(client):
    send_case(client)
    set_case(client, 1, status="accepted", published=True, comment="внутреннее")
    item = client.get("/api/cases/public").json()["items"][0]
    assert not {"contact", "ip_hash", "user_agent_short", "comment"} & item.keys()


def test_public_feed_lists_files_only_when_allowed(client):
    send_case(client, [("a.jpg", photo())])
    set_case(client, 1, status="accepted", published=True)
    assert client.get("/api/cases/public").json()["items"][0]["files"] == []


def test_case_with_link_source_is_marked_confirmed(client):
    send_case(client, sources="Решение суда\nhttps://www.aod.rs/")
    set_case(client, 1, status="accepted", published=True)
    assert client.get("/api/cases/public").json()["items"][0]["source_url"] == "https://www.aod.rs/"


def test_flags_must_be_boolean(client):
    send_case(client)
    assert set_case(client, 1, published="yes").status_code == 400


def test_unknown_case_status_is_rejected(client):
    send_case(client)
    assert set_case(client, 1, status="published").status_code == 400


def test_deleting_case_removes_its_files(client, tmp_path):
    send_case(client, [("a.jpg", photo())])
    name = first_file_name(client)
    client.delete("/admin/proposals/cases/1", headers=AUTH)
    assert not (uploads.files_root(tmp_path) / name).exists()


def test_cases_are_not_listed_with_material_proposals(client):
    send_case(client, summary="Уникальная история про ипотеку")
    assert "Уникальная история" not in client.get("/predlozheniya/").text
