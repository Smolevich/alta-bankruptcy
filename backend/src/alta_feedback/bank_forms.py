"""Бланки банков на открытие счёта и что банк спрашивает (data/bank_forms.json).

Копии PDF лежат в public/docs/banks сайта и открываются по /docs/banks/<file>. Бланки двух видов:
пустые, которые вкладчики принесли из отделения, и официальные с сайта банка (у них ссылка на оригинал).
"""

import json
from dataclasses import dataclass
from functools import cache
from importlib.resources import files

from alta_feedback.accounts import BANKS

DOCS_PREFIX = "/docs/banks/"
WHO = {"personal": "физлицо", "entrepreneur": "ИП", "company": "фирма"}
ORIGIN = {"depositor": "пустой бланк, прислал вкладчик", "official": "официальный, с сайта банка"}


@dataclass(frozen=True)
class Form:
    url: str
    title: str
    original: str
    who: str
    origin: str
    official: bool
    source_url: str | None
    pages: int


@dataclass(frozen=True)
class NoteSection:
    title: str
    items: tuple[str, ...]


@dataclass(frozen=True)
class Note:
    title: str
    source: str
    sections: tuple[NoteSection, ...]


@dataclass(frozen=True)
class BankForms:
    code: str
    name: str
    forms: tuple[Form, ...]
    notes: tuple[Note, ...]


def parse_form(raw: dict) -> Form:
    official = raw["origin"] == "official"
    if official and not raw.get("source_url", "").startswith("https://"):
        raise ValueError(f"official form {raw['file']} needs an https source_url")
    return Form(
        url=DOCS_PREFIX + raw["file"],
        title=raw["title"],
        original=raw["original"],
        who=", ".join(WHO[code] for code in raw["who"]),
        origin=ORIGIN[raw["origin"]],
        official=official,
        source_url=raw.get("source_url"),
        pages=raw["pages"],
    )


def parse_note(raw: dict) -> Note:
    sections = tuple(NoteSection(s["title"], tuple(s["items"])) for s in raw["sections"])
    return Note(raw["title"], raw["source"], sections)


def parse_catalog(data: dict) -> tuple[BankForms, ...]:
    """Банки в порядке файла; банк без бланков и пояснений в список не попадает."""
    banks = (
        BankForms(
            code=code,
            name=BANKS[code],
            forms=tuple(parse_form(form) for form in raw.get("forms", [])),
            notes=tuple(parse_note(note) for note in raw.get("notes", [])),
        )
        for code, raw in data["banks"].items()
    )
    return tuple(bank for bank in banks if bank.forms or bank.notes)


@cache
def catalog() -> tuple[BankForms, ...]:
    text = files("alta_feedback").joinpath("data/bank_forms.json").read_text(encoding="utf-8")
    return parse_catalog(json.loads(text))


def for_page(banks: tuple[BankForms, ...], bank_filter: str | None) -> tuple[BankForms, ...]:
    """Что показать на странице: все банки с бланками или только выбранный в фильтре."""
    if bank_filter is None:
        return banks
    return tuple(bank for bank in banks if bank.code == bank_filter)


def codes_by_name(banks: tuple[BankForms, ...]) -> dict[str, str]:
    """Название банка в сводке → код, чтобы у группы банка поставить ссылку на его бланки."""
    return {bank.name: bank.code for bank in banks}
