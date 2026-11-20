"""Official National Bank of Serbia figures per bank (data/nbs_banks.json).

Numbers are computed from NBS quarterly forms: the balance sheet (rows A, A.I, A.IV, A.VI, PO.III,
PK.XX) and the profit report (XXI.1 − XXI.2, 12 months); each figure has a link to its form.
A figure without an https link is not shown.
"""

import json
from dataclasses import dataclass
from datetime import date
from functools import cache
from importlib.resources import files

from alta_feedback.accounts import BANKS, match_label
from alta_feedback.branches import fold

TOP = 10
SOURCE_URL = "https://webappcenter.nbs.rs/WebApp/FinInstBank/BankFinancialBalanceSheet/IndexArchive"
# A bank without a license: kept in the size reference for comparison, not matched with form answers.
DEFUNCT = frozenset({"alta"})


@dataclass(frozen=True)
class Metric:
    key: str
    label: str
    explain: str
    digits: int


METRICS: tuple[Metric, ...] = (
    Metric("share", "Доля рынка", "какая часть всех активов банков Сербии приходится на этот банк", 1),
    Metric("equity_ratio", "Капитал к активам",
           "сколько собственных денег владельцев на каждые 100 динаров активов: "
           "ими банк первым покрывает убытки, раньше вкладчиков", 1),
    Metric("liquidity", "Деньги под рукой",
           "наличные, деньги на счёте в Народном банке и ценные бумаги "
           "на каждые 100 динаров активов", 1),
    Metric("loan_deposit", "Кредиты к вкладам",
           "сколько выдано кредитов клиентам на каждые 100 динаров их вкладов; "
           "больше 100 — кредиты не покрыты вкладами", 0),
    Metric("roa", "Прибыльность (ROA)",
           "сколько банк заработал за 12 месяцев (июль 2025 – июнь 2026) на каждые 100 динаров "
           "активов; минус — убыток. Ссылки 2–4 — отчёты, из которых сложена прибыль за 12 месяцев, "
           "и баланс с активами", 2),
)
ASSETS = Metric("assets", "Активы", "всё, чем владеет банк: кредиты, деньги, ценные бумаги — "
                "по ним видно размер банка", 1)


@dataclass(frozen=True)
class Figure:
    value: float
    source_url: str
    also: tuple[str, ...] = ()


@dataclass(frozen=True)
class Row:
    """Bank card row: label, number to display and where to verify it."""

    label: str
    text: str
    amount: str
    source_url: str
    also: tuple[str, ...]


@dataclass(frozen=True)
class Bank:
    code: str
    name: str
    rank: int
    aliases: tuple[str, ...]
    figures: dict[str, Figure]

    @property
    def defunct(self) -> bool:
        return self.code in DEFUNCT

    @property
    def size(self) -> Row | None:
        """Bank assets in billion dinars; None means the figure has no source."""
        return row(ASSETS, self.figures.get(ASSETS.key), " млрд RSD")

    @property
    def rows(self) -> list[Row]:
        return [r for metric in METRICS if (r := row(metric, self.figures.get(metric.key), " %"))]

    @property
    def share(self) -> Row | None:
        return next((r for r in self.rows if r.label == METRICS[0].label), None)

    @property
    def details(self) -> list[Row]:
        """Metrics shown when a bank row is expanded: all except market share."""
        return [r for r in self.rows if r.label != METRICS[0].label]


@dataclass(frozen=True)
class Snapshot:
    as_of: date
    bank_count: int
    banks: tuple[Bank, ...]

    @property
    def day(self) -> str:
        return self.as_of.strftime("%d.%m.%Y")

    def top(self, count: int = TOP) -> list[Bank]:
        return sorted(self.banks, key=lambda bank: bank.rank)[:count]

    def find(self, name: str) -> Bank | None:
        """NBS bank for a name from a form answer: by the form directory, otherwise by spelling."""
        code = match_label(name, BANKS)
        wanted = fold(name)
        for bank in self.banks:
            if bank.defunct:
                continue
            if bank.code == code or any(called(wanted, alias) for alias in bank.aliases):
                return bank
        return None

    def listing(self, names: list[str]) -> tuple[list[Bank], list[Bank]]:
        """Banks from form answers (in their order, no repeats) and the rest from the top by size."""
        reported: list[Bank] = []
        for name in names:
            bank = self.find(name)
            if bank and bank not in reported:
                reported.append(bank)
        return reported, [bank for bank in self.top() if bank not in reported]


def called(wanted: str, alias: str) -> bool:
    """'Raiffeisen banka Srbija' is also Raiffeisen: alias by the whole first word (words)."""
    return wanted == alias or wanted.startswith(alias + " ")


def number(value: float, digits: int) -> str:
    """Number in Russian style: space between thousands, comma before the fraction, a real minus."""
    text = f"{abs(value):,.{digits}f}".replace(",", " ").replace(".", ",")
    return f"−{text}" if value < 0 else text


def sourced(figure: Figure | None) -> bool:
    return figure is not None and figure.source_url.startswith("https://")


def row(metric: Metric, figure: Figure | None, unit: str) -> Row | None:
    if not sourced(figure):
        return None
    amount = number(figure.value, metric.digits)
    return Row(metric.label, amount + unit, amount, figure.source_url, figure.also)


def parse_figure(raw: dict) -> Figure:
    return Figure(float(raw["value"]), raw.get("source_url") or "", tuple(raw.get("also", ())))


def parse_snapshot(raw: dict) -> Snapshot:
    banks = tuple(
        Bank(
            code=item["code"],
            name=item["name"],
            rank=int(item["rank"]),
            aliases=tuple(fold(alias) for alias in item.get("aliases", ())),
            figures={key: parse_figure(value) for key, value in item["figures"].items()},
        )
        for item in raw["banks"]
    )
    return Snapshot(date.fromisoformat(raw["as_of"]), int(raw["bank_count"]), banks)


@cache
def snapshot() -> Snapshot:
    text = files("alta_feedback").joinpath("data/nbs_banks.json").read_text(encoding="utf-8")
    return parse_snapshot(json.loads(text))
