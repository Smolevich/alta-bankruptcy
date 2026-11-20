"""Directory of bank branches (data/branches.json, built by scripts/build_branches.py) and branch
selection."""

import json
import unicodedata
from dataclasses import dataclass
from functools import cache
from importlib.resources import files

BRANCH_MAX = 120
NOT_SURE = "Не помню / не важно"
# Form cities as bank websites spell them.
CITY_LATIN: dict[str, str] = {
    "beograd": "Beograd",
    "novisad": "Novi Sad",
    "nis": "Niš",
    "kragujevac": "Kragujevac",
    "subotica": "Subotica",
}
CYRILLIC = dict(zip(
    "абвгдђежзийклљмнњопрстћуфхцчџшщыэюяё",
    ["a", "b", "v", "g", "d", "dj", "e", "z", "z", "i", "j", "k", "l", "lj", "m", "n", "nj", "o", "p",
     "r", "s", "t", "c", "u", "f", "h", "c", "c", "dz", "s", "s", "i", "e", "ju", "ja", "e"],
    strict=True,
))


@dataclass(frozen=True)
class Branch:
    city: str
    name: str
    address: str

    @property
    def label(self) -> str:
        """Suggestion row and the value saved into the report."""
        return f"{self.name} — {self.address}" if self.name else self.address


type Directory = dict[str, tuple[Branch, ...]]


def fold(text: str) -> str:
    """Comparison key: Latin without diacritics or case, hyphens as spaces ("Нови-Сад" = "Novi Sad")."""
    lowered = text.casefold().replace("đ", "dj")
    latin = "".join(CYRILLIC.get(char, char) for char in lowered)
    plain = "".join(c for c in unicodedata.normalize("NFKD", latin) if not unicodedata.combining(c))
    return " ".join(plain.replace("-", " ").split())


def parse_directory(raw: dict) -> Directory:
    return {
        code: tuple(Branch(item["city"], item["name"], item["address"]) for item in entry["branches"])
        for code, entry in raw["banks"].items()
    }


@cache
def directory() -> Directory:
    text = files("alta_feedback").joinpath("data/branches.json").read_text(encoding="utf-8")
    return parse_directory(json.loads(text))


def city_key(city_code: str | None, city_text: str) -> str:
    """Form city (directory code or free text) as a comparison key against bank cities."""
    return fold(CITY_LATIN.get(city_code or "", city_text))


def branch_options(branches: tuple[Branch, ...], city: str) -> list[str]:
    """Suggestions for the branch field: the NOT_SURE option and the bank's branches in this city."""
    labels = sorted({item.label for item in branches if fold(item.city) == city}, key=fold)
    return [NOT_SURE, *labels]


def match_branch(raw: str, branches: tuple[Branch, ...]) -> str | None:
    """Name from the bank directory if the person picked it from suggestions (case-insensitive)."""
    wanted = fold(raw)
    return next((item.label for item in branches if fold(item.label) == wanted), None)
