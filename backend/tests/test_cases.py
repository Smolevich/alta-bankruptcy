import pytest

from alta_feedback.cases import (
    CaseFilter,
    Mark,
    case_banks,
    criteria,
    criteria_checked,
    parse_case_filter,
)

CRITERIA = {
    "yettel": {
        "official": [{
            "title": "Правила", "url": "https://bank.example/rules", "date": "2026-11-04",
            "who": ["personal"], "items": ["Паспорт"],
        }],
        "chat": [
            {"who": ["personal"], "vnzh": "yes", "text": "С ВНЖ просят договор"},
            {"who": ["personal"], "vnzh": "no", "text": "Без ВНЖ просят покупку жилья"},
            {"who": ["entrepreneur"], "vnzh": "any", "text": "Для ИП — решение APR"},
        ],
    },
}


def item(
    item_id: int = 1, bank: str = "OTP banka", account_type: str = "personal", result: str = "opened",
    residency: str = "boravak", documents: tuple[str, ...] = ("passport",), person: str | None = None,
) -> dict:
    return {
        "id": item_id, "bank": bank, "account_type": account_type, "result": result,
        "residency": residency, "documents": list(documents), "person": person,
    }


def names(cards) -> list[str]:
    return [card.name for card in cards if card.people]


def test_personal_case_includes_both_at_once():
    cards = case_banks([item(account_type="both")], CaseFilter(case="personal"), {})
    assert names(cards) == ["OTP banka"]


def test_entrepreneur_case_includes_both_at_once():
    cards = case_banks([item(account_type="both")], CaseFilter(case="entrepreneur"), {})
    assert names(cards) == ["OTP banka"]


def test_both_case_skips_single_applications():
    cards = case_banks([item(account_type="personal")], CaseFilter(case="both"), {})
    assert names(cards) == []


def test_no_vnzh_case_keeps_white_card_and_tourist_only():
    items = [
        item(1, residency="boravak"), item(2, "Erste", residency="white_card"),
        item(3, "NLB Banka", residency="tourist"),
    ]
    assert names(case_banks(items, CaseFilter(vnzh="no"), {})) == ["Erste", "NLB Banka"]


def test_people_are_counted_once_per_person_not_per_answer():
    items = [item(1, person="p1"), item(2, person="p1"), item(3, person="p2")]
    assert case_banks(items, CaseFilter(), {})[0].people == 2


def test_answers_with_wiped_hash_count_as_separate_people():
    items = [item(1, person=""), item(2, person=None)]
    assert case_banks(items, CaseFilter(), {})[0].people == 2


def test_document_named_by_three_people_is_confirmed():
    items = [item(n, person=f"p{n}") for n in (1, 2, 3)]
    assert case_banks(items, CaseFilter(), {})[0].documents == (Mark("Паспорт", 3),)


@pytest.mark.parametrize(("people", "level"), [(1, "one"), (2, "two"), (3, "confirmed"), (7, "confirmed")])
def test_mark_level_follows_number_of_people(people, level):
    assert Mark("Паспорт", people).level == level


def test_split_shows_documents_of_opened_and_refused_separately():
    items = [
        item(1, result="opened", documents=("passport", "apr"), person="p1"),
        item(2, result="refused", documents=("passport",), person="p2"),
    ]
    split = case_banks(items, CaseFilter(), {})[0].split
    assert [mark.name for mark in split.opened_docs] == ["PIB и решение APR (ИП)", "Паспорт"]


def test_no_split_when_all_answers_agree():
    items = [item(1, result="refused", person="p1"), item(2, result="refused", person="p2")]
    assert case_banks(items, CaseFilter(), {})[0].split is None


def test_bank_with_rules_but_no_answers_is_listed_after_banks_with_answers():
    cards = case_banks([item()], CaseFilter(), CRITERIA)
    assert [card.name for card in cards] == ["OTP banka", "Yettel Bank"]


def test_chat_criteria_follow_vnzh_choice():
    card = case_banks([], CaseFilter(case="personal", vnzh="no"), CRITERIA)[0]
    assert card.chat == ("Без ВНЖ просят покупку жилья",)


def test_chat_criteria_marked_any_fit_every_vnzh():
    card = case_banks([], CaseFilter(case="entrepreneur", vnzh="no"), CRITERIA)[0]
    assert card.chat == ("Для ИП — решение APR",)


def test_personal_rules_are_hidden_in_entrepreneur_case():
    card = case_banks([], CaseFilter(case="entrepreneur"), CRITERIA)[0]
    assert card.official == ()


def test_unknown_case_and_vnzh_are_ignored():
    assert parse_case_filter({"case": "company", "vnzh": "maybe"}) == CaseFilter()


def test_criteria_file_names_only_known_banks_and_https_rules():
    rules = [rule for raw in criteria().values() for rule in raw.get("official", [])]
    assert rules and all(rule["url"].startswith("https://") for rule in rules)


def test_criteria_date_is_shown_day_first():
    assert criteria_checked() == "04.11.2026"
