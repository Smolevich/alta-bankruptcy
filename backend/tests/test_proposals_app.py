import re

import pytest
from starlette.testclient import TestClient

from alta_feedback.main import create_app

TOKEN = "admin-secret"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
PAGE = "/predlozheniya/"


@pytest.fixture
def client(tmp_path) -> TestClient:
    return TestClient(create_app(data_dir=tmp_path, admin_token=TOKEN, ip_salt="salt"))


def propose(client: TestClient, ip: str = "203.0.113.5", path: str = PAGE, **fields):
    data = {
        "title": "Сроки подачи требования",
        "text": "Срок — 30 дней с публикации решения суда.",
        "sources": "https://www.aod.rs/\nРешение Привредного суда от 03.11.2026",
        "target": "site",
        "contact": "@ivan_secret",
        **fields,
    }
    return client.post(path, data=data, headers={"CF-Connecting-IP": ip}, follow_redirects=False)


def admin_items(client: TestClient, **params) -> list[dict]:
    return client.get("/admin/proposals", params=params, headers=AUTH).json()["items"]


def edit(client: TestClient, item_id: int, **fields):
    return client.post(f"/admin/proposals/{item_id}", json=fields, headers=AUTH)


def test_submission_redirects_to_its_card_in_the_list(client):
    location = propose(client).headers["location"]
    assert re.fullmatch(r"/predlozheniya/\?sent=1#p1", location)


def test_submitted_proposal_is_listed_on_the_page(client):
    propose(client, title="Как подать требование")
    assert "Как подать требование" in client.get(PAGE).text


def test_admin_sees_full_proposal_with_contact_and_sources(client):
    propose(client)
    item = admin_items(client)[0]
    assert (item["contact"], item["sources"], item["status"]) == (
        "@ivan_secret", ["https://www.aod.rs/", "Решение Привредного суда от 03.11.2026"], "new",
    )


def test_public_list_hides_author_contact(client):
    propose(client)
    assert "@ivan_secret" not in client.get(PAGE).text


def test_proposal_without_sources_is_rejected(client):
    assert propose(client, sources=" \n  ").status_code == 400


def test_proposal_without_text_and_link_is_rejected(client):
    assert propose(client, text="", doc_url="").status_code == 400


def test_link_alone_is_enough_without_text(client):
    assert propose(client, text="", doc_url="https://docs.google.com/document/d/x").status_code == 303


def test_document_link_must_be_http(client):
    assert propose(client, doc_url="javascript:alert(1)").status_code == 400


def test_unknown_target_is_rejected(client):
    assert propose(client, target="newspaper").status_code == 400


def test_rejected_form_keeps_what_was_typed(client):
    page = propose(client, sources="", text="Длинный черновик текста").text
    assert "Длинный черновик текста" in page and "хотя бы один источник" in page


def test_text_of_twenty_thousand_cyrillic_characters_is_accepted(client):
    assert propose(client, text="ж" * 20_000).status_code == 303


def test_text_over_limit_is_rejected(client):
    assert propose(client, text="x" * 20_001).status_code == 400


def test_honeypot_submission_is_not_stored(client):
    propose(client, website="http://spam.example")
    assert admin_items(client) == []


def test_sixth_proposal_in_hour_is_limited(client):
    codes = [propose(client).status_code for _ in range(6)]
    assert codes == [303] * 5 + [429]


def test_proposal_limit_is_per_ip(client):
    for _ in range(5):
        propose(client, ip="203.0.113.1")
    assert propose(client, ip="203.0.113.2").status_code == 303


def test_stored_ip_is_hashed_not_raw(client):
    propose(client, ip="198.51.100.77")
    assert "198.51.100.77" not in str(admin_items(client))


def test_page_is_not_indexed(client):
    response = client.get(PAGE)
    assert response.headers["x-robots-tag"] == "noindex, nofollow"
    assert '<meta name="robots" content="noindex, nofollow">' in response.text


def test_page_without_slash_redirects(client):
    assert client.get("/predlozheniya", follow_redirects=False).headers["location"] == PAGE


@pytest.mark.parametrize(("path", "title"), [("/en/predlozheniya/", "Suggest material"),
                                             ("/sr/predlozheniya/", "Predložite materijal")])
def test_translated_pages_have_title_and_form(client, path, title):
    page = client.get(path).text
    assert f"<h1>{title}</h1>" in page and f'action="{path}"' in page


def test_english_form_reports_errors_in_english(client):
    page = propose(client, path="/en/predlozheniya/", sources="").text
    assert "Give at least one source." in page


def test_editor_status_comment_and_links_show_in_list(client):
    propose(client)
    edit(client, 1, status="needs_changes", review_url="https://docs.google.com/document/d/r",
         comment="Нужна ссылка на закон")
    page = client.get(PAGE).text
    assert "Нужны правки" in page and "https://docs.google.com/document/d/r" in page
    assert "Нужна ссылка на закон" in page


def test_editor_update_changes_only_given_fields(client):
    propose(client)
    edit(client, 1, comment="тест")
    edit(client, 1, status="rejected")
    item = admin_items(client)[0]
    assert (item["status"], item["comment"]) == ("rejected", "тест")


def test_admin_filters_by_status(client):
    propose(client)
    propose(client, title="Второе")
    edit(client, 2, status="published", published_url="https://t.me/altabank_closed/1")
    assert [item["title"] for item in admin_items(client, status="published")] == ["Второе"]


def test_unknown_status_is_rejected(client):
    propose(client)
    assert edit(client, 1, status="done").status_code == 400


def test_editor_link_must_be_http(client):
    propose(client)
    assert edit(client, 1, published_url="ftp://x").status_code == 400


def test_update_of_missing_proposal_is_404(client):
    assert edit(client, 99, status="rejected").status_code == 404


def test_spam_is_hidden_from_public_list(client):
    propose(client, title="Купите крипту")
    edit(client, 1, status="spam")
    assert "Купите крипту" not in client.get(PAGE).text


def test_deleted_proposal_disappears(client):
    propose(client)
    client.delete("/admin/proposals/1", headers=AUTH)
    assert admin_items(client) == []


@pytest.mark.parametrize(("method", "path"), [("GET", "/admin/proposals"), ("POST", "/admin/proposals/1"),
                                              ("DELETE", "/admin/proposals/1")])
def test_admin_api_requires_token(client, method, path):
    propose(client)
    assert client.request(method, path, json={"status": "rejected"}).status_code == 401


def test_admin_page_carries_no_data_and_is_not_indexed(client):
    propose(client)
    response = client.get("/predlozheniya/admin/")
    assert "@ivan_secret" not in response.text and response.headers["x-robots-tag"] == "noindex, nofollow"


def test_admin_page_loads_only_own_script(client):
    csp = client.get("/predlozheniya/admin/").headers["content-security-policy"]
    assert "script-src 'self';" in csp and "connect-src 'self';" in csp


def test_admin_script_is_served(client):
    assert client.get("/static/proposals-admin.js").status_code == 200
