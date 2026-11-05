import re
import sqlite3

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


@pytest.mark.parametrize(
    ("path", "header"),
    [
        ("/en/predlozheniya/", '<a class="site-title" href="/en/">ALTA depositors: what&#39;s next</a>'),
        ("/sr/predlozheniya/", '<a class="site-title" href="/sr/">Štediše ALTA banke: šta dalje</a>'),
    ],
)
def test_site_header_follows_page_language(client, path, header):
    assert header in client.get(path).text


def public_body(client: TestClient, item_id: int = 1) -> str:
    """HTML текста предложения на публичной странице."""
    card = client.get(PAGE).text.split(f'id="p{item_id}"')[1].split("</article>")[0]
    return card.split('<div class="body rich">')[1].split("</div>")[0]


def test_editor_html_is_published_cleaned(client):
    propose(client, text_format="html",
            text='<h2>Сроки</h2><p onclick="x()"><strong>30 дней</strong><script>alert(1)</script></p>')
    body = public_body(client)
    assert "<h2>Сроки</h2><p><strong>30 дней</strong></p>" in body and "alert" not in body


@pytest.mark.parametrize(
    "dirty",
    ['<img src=x onerror=alert(1)>текст', '<a href="&#106;avascript:alert(1)">текст</a>',
     '<svg onload=alert(1)></svg>текст', '<iframe src=https://evil.example></iframe>текст',
     '<p style="x:expression(alert(1))">текст</p>',
     '<a href="data:text/html,<script>alert(1)</script>">текст</a>'],
)
def test_public_page_never_renders_active_markup(client, dirty):
    propose(client, text_format="html", text=dirty)
    body = public_body(client)
    bad = ("onerror", "onload", "javascript:", "<svg", "<iframe", "style=", "data:")
    assert not any(marker in body for marker in bad)


def test_plain_text_without_js_is_shown_as_text(client):
    propose(client, text="Строка <b>не тег</b>\nвторая")
    assert "Строка &lt;b&gt;не тег&lt;/b&gt;<br>вторая" in public_body(client)


def test_text_limit_counts_visible_characters_not_tags(client):
    text = "<p><strong>" + "а" * 100 + "</strong></p>"
    assert propose(client, text_format="html", text=text * 150).status_code == 303


def test_editor_text_over_limit_is_rejected_on_submit(client):
    assert propose(client, text_format="html", text="<p>" + "а" * 20_001 + "</p>").status_code == 400


def test_markup_without_text_counts_as_empty(client):
    response = propose(client, text_format="html", text="<p><br></p><script>x</script>")
    assert response.status_code == 400


def test_rejected_form_returns_cleaned_html_to_editor(client):
    response = propose(client, title="", text_format="html", text="<p>ok<script>alert(1)</script></p>")
    assert "alert(1)" not in response.text


def test_editor_text_is_published_and_author_original_kept(client):
    propose(client, text_format="html", text="<p>Текст автора</p>")
    edit(client, 1, edited_text="<p>Текст <em>редактора</em></p>")
    assert "Текст <em>редактора</em>" in public_body(client)
    item = admin_items(client)[0]
    assert item["text"] == "<p>Текст автора</p>" and item["text_html"] == "<p>Текст автора</p>"


def test_editor_text_is_cleaned(client):
    propose(client)
    edit(client, 1, edited_text='<p>ok</p><img src=x onerror=alert(1)><a href="javascript:x">y</a>')
    assert admin_items(client)[0]["edited_text"] == "<p>ok</p>y"


def test_clearing_editor_text_brings_back_author_text(client):
    propose(client, text="Текст автора")
    edit(client, 1, edited_text="<p>Правка</p>")
    edit(client, 1, edited_text="")
    assert "Текст автора" in public_body(client)


def test_editor_text_at_limit_fits_into_request(client):
    """Кириллица в JSON — по 2 байта на знак: 20 000 знаков не пролезали в общий лимит тела 16 КБ."""
    propose(client)
    assert edit(client, 1, edited_text="<p>" + "а" * 20_000 + "</p>").status_code == 200


def test_editor_text_over_limit_is_rejected(client):
    propose(client)
    assert edit(client, 1, edited_text="<p>" + "а" * 20_001 + "</p>").status_code == 400


def test_old_plain_text_proposal_is_escaped(client, tmp_path):
    propose(client)
    with sqlite3.connect(tmp_path / "feedback.db") as db:
        db.execute("UPDATE proposals SET text = '<script>alert(1)</script>', text_format = NULL")
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in public_body(client)


def test_proposal_page_loads_own_editor_script(client):
    csp = client.get(PAGE).headers["content-security-policy"]
    assert "script-src 'self'" in csp and "unsafe-eval" not in csp


def test_editor_script_is_served(client):
    assert client.get("/static/richtext.js").status_code == 200
