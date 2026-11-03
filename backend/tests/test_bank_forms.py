from pathlib import Path

import pytest
from starlette.testclient import TestClient
from test_account_app import seed

from alta_feedback.bank_forms import catalog, for_page, parse_catalog
from alta_feedback.main import create_app

SITE_COPIES = Path(__file__).parents[2] / "public" / "docs" / "banks"

FORM = {
    "file": "acme-zahtev.pdf", "title": "Заявление", "original": "Zahtev", "who": ["entrepreneur"],
    "origin": "depositor", "pages": 1,
}


@pytest.fixture
def client(tmp_path) -> TestClient:
    return TestClient(create_app(data_dir=tmp_path, admin_token="t", ip_salt="salt", pow_max_number=50))


def test_bank_without_forms_or_notes_is_not_listed():
    banks = parse_catalog({"banks": {"otp": {"forms": [], "notes": []}, "nlb": {"forms": [FORM]}}})
    assert [bank.code for bank in banks] == ["nlb"]


def test_official_form_without_https_original_is_rejected():
    with pytest.raises(ValueError):
        parse_catalog({"banks": {"nlb": {"forms": [{**FORM, "origin": "official"}]}}})


def test_bank_filter_keeps_only_that_bank():
    banks = parse_catalog({"banks": {"nlb": {"forms": [FORM]}, "erste": {"forms": [FORM]}}})
    assert [bank.code for bank in for_page(banks, "erste")] == ["erste"]


def test_every_listed_form_has_a_copy_on_the_site():
    listed = [Path(f.url).name for bank in catalog() for f in bank.forms]
    missing = [name for name in listed if not (SITE_COPIES / name).is_file()]
    assert missing == []


def test_every_copy_on_the_site_is_listed():
    listed = {Path(f.url).name for bank in catalog() for f in bank.forms}
    assert {path.name for path in SITE_COPIES.glob("*.pdf")} == listed


def test_stats_page_lists_forms_even_without_answers(client):
    page = client.get("/account/stats").text
    assert 'id="forms-procredit"' in page


def test_form_opens_in_on_site_viewer(client):
    page = client.get("/account/stats").text
    url = "/docs/banks/unicredit-upitnik-pravna-lica.pdf"
    assert f'href="{url}" data-pdf="{url}"' in page


def test_official_form_links_to_bank_original(client):
    page = client.get("/account/stats").text
    assert 'href="https://www.adriaticbank.rs/pdf/Dokumenti/Form8054.pdf"' in page


def test_unicredit_shows_what_the_instruction_asks(client):
    page = client.get("/account/stats", params={"bank": "unicredit"}).text
    assert "инструкции UniCredit, сфотографированной вкладчиком 03.11.2026" in page


def test_bank_without_forms_hides_the_block(client):
    page = client.get("/account/stats", params={"bank": "otp"}).text
    assert 'id="forms"' not in page


def test_bank_filter_shows_only_that_banks_forms_opened(client):
    page = client.get("/account/stats", params={"bank": "procredit"}).text
    assert ('id="forms-procredit" open' in page, 'id="forms-unicredit"' in page) == (True, False)


def test_bank_group_links_to_its_forms(client):
    seed(client, 1, bank="UniCredit")
    assert 'href="#forms-unicredit"' in client.get("/account/stats").text


def test_bank_group_without_forms_has_no_link(client):
    seed(client, 1)
    assert 'class="forms-link"' not in client.get("/account/stats").text.split('id="forms"')[0]


def test_pdf_view_script_is_served(client):
    assert client.get("/static/pdfview.js").status_code == 200
