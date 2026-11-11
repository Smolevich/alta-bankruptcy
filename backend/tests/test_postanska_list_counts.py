"""Страницы называют то же число мест выплаты и городов, что и src/data/postanska-branches.json."""

import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[2]
SITE_LIST = ROOT / "src/data/postanska-branches.json"
DOCS = ROOT / "src/content/docs"
PAGES = ("vyplata.mdx", "index.mdx", "voprosy.mdx", "bezopasnost.mdx")
PLACES = {
    "ru": re.compile(r"(\d+) мест(?:ах|а)?\b"),
    "en": re.compile(r"(\d+) (?:payout )?locations\b"),
    "sr": re.compile(r"(\d+) (?:isplatnih )?mesta\b"),
}
CITIES = {
    "ru": re.compile(r"(\d+) город"),
    "en": re.compile(r"(\d+) cities\b"),
    "sr": re.compile(r"(\d+) gradova\b"),
}


def city_of(naziv: str) -> str:
    """Город из названия, как в PostanskaBranches.astro: «EKSPOZITURA NOVI SAD 3» → «NOVI SAD»."""
    name = re.sub(r"^(EKSPOZITURA|Samostalni šalter) ", "", naziv)
    return re.sub(r" \d+.*$", "", name).upper()


def list_counts() -> tuple[int, int]:
    site = json.loads(SITE_LIST.read_text("utf-8"))
    places = 1 + len(site["ekspoziture"])
    cities = {city_of(b["naziv"]) for b in site["ekspoziture"]}
    return places, len(cities)


def page(lang: str, name: str) -> str:
    return (DOCS / ("" if lang == "ru" else lang) / name).read_text("utf-8")


def test_list_counts_new_cities_from_the_11_11_list():
    assert list_counts() == (57, 15)


def test_city_of_handles_renamed_nis_counter():
    assert city_of("Samostalni šalter Niš 1") == "NIŠ"


@pytest.mark.parametrize("lang", ["ru", "en", "sr"])
@pytest.mark.parametrize("name", PAGES)
def test_page_states_place_count_of_the_list(lang: str, name: str):
    found = {int(n) for n in PLACES[lang].findall(page(lang, name))}
    assert found == {list_counts()[0]}


@pytest.mark.parametrize("lang", ["ru", "en", "sr"])
@pytest.mark.parametrize("name", ("vyplata.mdx", "index.mdx", "voprosy.mdx"))
def test_page_states_city_count_of_the_list(lang: str, name: str):
    found = {int(n) for n in CITIES[lang].findall(page(lang, name))}
    assert found == {list_counts()[1]}
