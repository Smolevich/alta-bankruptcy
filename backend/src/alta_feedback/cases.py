"""«Мой случай» на странице статистики: что просили по каждому банку у людей в такой же ситуации.

Числа — только из принятых ответов формы (сколько разных людей); официальные правила банков и
критерии из открытых чатов вкладчиков — из data/bank_criteria.json, у чатов чисел нет.
"""

import json
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass
from functools import cache
from importlib.resources import files

from alta_feedback.accounts import BANKS, DOCUMENTS

CASES: dict[str, str] = {
    "personal": "Личный счёт",
    "entrepreneur": "Счёт ИП",
    "both": "Личный и ИП сразу",
}
VNZH: dict[str, str] = {"yes": "Есть ВНЖ / ПМЖ", "no": "Нет ВНЖ: белый картон или турист"}
# «Оба сразу» — это и личная заявка, и заявка ИП.
CASE_TYPES = {
    "personal": {"personal", "both"},
    "entrepreneur": {"entrepreneur", "both"},
    "both": {"both"},
}
VNZH_RESIDENCIES = {"yes": {"boravak"}, "no": {"white_card", "tourist"}}
# Сколько разных людей нужно, чтобы назвать факт подтверждённым.
CONFIRMED_MIN = 3


@dataclass(frozen=True)
class CaseFilter:
    case: str | None = None
    vnzh: str | None = None

    def query(self) -> dict[str, str]:
        pairs = {"case": self.case, "vnzh": self.vnzh}
        return {name: value for name, value in pairs.items() if value}


@dataclass(frozen=True)
class Mark:
    """Документ и сколько разных людей его назвали."""

    name: str
    people: int

    @property
    def level(self) -> str:
        if self.people >= CONFIRMED_MIN:
            return "confirmed"
        return "two" if self.people == 2 else "one"


@dataclass(frozen=True)
class Official:
    title: str
    url: str
    date: str
    items: tuple[str, ...]


@dataclass(frozen=True)
class Split:
    """Документы у тех, кому открыли, и у тех, кому отказали, в одном банке."""

    opened: int
    refused: int
    opened_docs: tuple[Mark, ...]
    refused_docs: tuple[Mark, ...]


@dataclass(frozen=True)
class BankCase:
    name: str
    code: str | None
    people: int
    results: Counter
    documents: tuple[Mark, ...]
    split: Split | None
    official: tuple[Official, ...]
    chat: tuple[str, ...]


def parse_case_filter(params: Mapping[str, str]) -> CaseFilter:
    case = params.get("case")
    vnzh = params.get("vnzh")
    return CaseFilter(case if case in CASES else None, vnzh if vnzh in VNZH else None)


def in_case(item: dict, case_filter: CaseFilter) -> bool:
    if case_filter.case and item["account_type"] not in CASE_TYPES[case_filter.case]:
        return False
    return not case_filter.vnzh or item["residency"] in VNZH_RESIDENCIES[case_filter.vnzh]


def person_of(item: dict) -> str:
    """Один человек — один хэш IP; когда хэш уже стёрт, каждый ответ считаем отдельным человеком."""
    return item.get("person") or f"id:{item['id']}"


def document_marks(items: list[dict]) -> tuple[Mark, ...]:
    people: dict[str, set[str]] = {}
    for item in items:
        for doc in item["documents"]:
            people.setdefault(DOCUMENTS.get(doc, doc), set()).add(person_of(item))
    marks = (Mark(name, len(who)) for name, who in people.items())
    return tuple(sorted(marks, key=lambda mark: (-mark.people, mark.name)))


def split_of(items: list[dict]) -> Split | None:
    """Есть и открытые, и отказы — показать, чем отличались документы; иначе None."""
    opened = [item for item in items if item["result"] == "opened"]
    refused = [item for item in items if item["result"] == "refused"]
    if not opened or not refused:
        return None
    return Split(
        len({person_of(item) for item in opened}),
        len({person_of(item) for item in refused}),
        document_marks(opened),
        document_marks(refused),
    )


def code_of(name: str) -> str | None:
    return next((code for code, label in BANKS.items() if label == name), None)


def wanted_types(case_filter: CaseFilter) -> set[str]:
    """Для каких счетов нужны правила: «оба сразу» и «не выбрано» — для обоих."""
    if case_filter.case in (None, "both"):
        return {"personal", "entrepreneur"}
    return {case_filter.case}


def chat_items(raw: dict, case_filter: CaseFilter) -> tuple[str, ...]:
    wanted = wanted_types(case_filter)
    return tuple(
        entry["text"] for entry in raw.get("chat", [])
        if wanted & set(entry["who"])
        and (not case_filter.vnzh or entry["vnzh"] in ("any", case_filter.vnzh))
    )


def official_items(raw: dict, case_filter: CaseFilter) -> tuple[Official, ...]:
    wanted = wanted_types(case_filter)
    return tuple(
        Official(entry["title"], entry["url"], entry["date"], tuple(entry["items"]))
        for entry in raw.get("official", [])
        if wanted & set(entry["who"])
    )


def bank_case(name: str, items: list[dict], raw: dict, case_filter: CaseFilter) -> BankCase:
    return BankCase(
        name=name,
        code=code_of(name),
        people=len({person_of(item) for item in items}),
        results=Counter(item["result"] for item in items),
        documents=document_marks(items),
        split=split_of(items),
        official=official_items(raw, case_filter),
        chat=chat_items(raw, case_filter),
    )


def case_banks(items: list[dict], case_filter: CaseFilter, criteria: Mapping[str, dict]) -> list[BankCase]:
    """Банки с ответами в этом случае (больше людей — выше), потом банки только с правилами или чатами."""
    chosen = [item for item in items if in_case(item, case_filter)]
    by_bank: dict[str, list[dict]] = {}
    for item in chosen:
        by_bank.setdefault(item["bank"], []).append(item)
    cards = [
        bank_case(name, bank_items, criteria.get(code_of(name) or "", {}), case_filter)
        for name, bank_items in by_bank.items()
    ]
    cards.sort(key=lambda card: (-card.people, card.name))
    rest = [
        bank_case(BANKS[code], [], raw, case_filter)
        for code, raw in criteria.items()
        if BANKS[code] not in by_bank
    ]
    return cards + [card for card in rest if card.official or card.chat]


@cache
def criteria_file() -> dict:
    text = files("alta_feedback").joinpath("data/bank_criteria.json").read_text(encoding="utf-8")
    data = json.loads(text)
    unknown = set(data["banks"]) - set(BANKS)
    if unknown:
        raise ValueError(f"unknown bank codes in bank_criteria.json: {sorted(unknown)}")
    for raw in data["banks"].values():
        for entry in raw.get("official", []):
            if not entry["url"].startswith("https://"):
                raise ValueError(f"official rule without https url: {entry['title']}")
    return data


def criteria() -> dict[str, dict]:
    return criteria_file()["banks"]


def criteria_checked() -> str:
    """Дата проверки правил и критериев, ДД.ММ.ГГГГ."""
    return ".".join(reversed(criteria_file()["checked"].split("-")))
