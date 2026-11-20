"""Bank account-opening forms and what the bank asks (data/bank_forms.json).

PDF copies live in the site's public/docs/banks and open at /docs/banks/<file>. Forms are of two kinds:
blank ones that depositors brought from a branch, and official ones from the bank's website (with a link
to the original).
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
    """Banks in file order; a bank with no forms and no notes is left out of the list."""
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
    """What to show on the page: all banks with forms, or only the one selected in the filter."""
    if bank_filter is None:
        return banks
    return tuple(bank for bank in banks if bank.code == bank_filter)


def codes_by_name(banks: tuple[BankForms, ...]) -> dict[str, str]:
    """Bank name in the summary -> code, to link the bank's group to its forms."""
    return {bank.name: bank.code for bank in banks}
