"""Anonymous "where did they open my account" reports: directories, form parsing, personal-data scrubbing."""

import re
from dataclasses import dataclass
from datetime import date, timedelta

from alta_feedback.branches import BRANCH_MAX, NOT_SURE, Branch, Directory, fold, match_branch

# Active banks per the NBS register as of 01.11.2026 (excluding ALTA), most common among foreigners first.
BANKS: dict[str, str] = {
    "intesa": "Banca Intesa",
    "otp": "OTP banka",
    "raiffeisen": "Raiffeisen",
    "unicredit": "UniCredit",
    "aik": "AikBank",
    "nlb": "NLB Banka",
    "postanska": "Poštanska štedionica",
    "erste": "Erste",
    "addiko": "Addiko",
    "procredit": "ProCredit",
    "halkbank": "Halkbank",
    "yettel": "Yettel Bank",
    "adriatic": "Adriatic Bank",
    "3banka": "3 Banka",
    "api": "API Bank",
    "mirabank": "Mirabank",
    "bankofchina": "Bank of China",
    "srpska": "Srpska banka",
}
CITIES: dict[str, str] = {
    "beograd": "Белград",
    "novisad": "Нови-Сад",
    "nis": "Ниш",
    "kragujevac": "Крагуевац",
    "subotica": "Суботица",
}
# "Both" is one visit, two applications: in the summary such an answer counts among both personal and
# sole-proprietor ones.
ACCOUNT_TYPES: dict[str, str] = {
    "personal": "Личный", "entrepreneur": "ИП (preduzetnik)", "both": "Личный и ИП сразу",
}
RESULTS: dict[str, str] = {"opened": "Открыли", "refused": "Отказали", "pending": "Ещё в процессе"}
# Temporary and permanent residence permits are the same for banks, so one chip.
RESIDENCIES: dict[str, str] = {
    "boravak": "ВНЖ / ПМЖ (боравак)",
    "white_card": "Только белый картон",
    "tourist": "Ничего нет (турист)",
    "citizen": "Гражданин Сербии",
}
DOCUMENTS: dict[str, str] = {
    "passport": "Паспорт",
    "boravak": "Боравак / ВНЖ",
    "jmbg": "JMBG / EBS",
    "lease": "Договор аренды / белый картон",
    "income": "Справка с работы / доход",
    "apr": "PIB и решение APR (ИП)",
    "reference": "Рекомендация другого банка",
    "statements": "Выписки из другого банка",
    "nothing": "Ничего сверх обычного",
}
FREE_TEXT_MAX = 60
DOCUMENTS_MAX = 15
COMMENT_MAX = 1000
VISIT_DAYS_BACK = 400
ACCOUNT_STATUSES = frozenset({"new", "accepted", "rejected", "test", "spam"})

MASK = "[скрыто]"
# Order matters: long account numbers first, then 13-digit JMBG, then everything else that is long.
PII_PATTERNS = (
    re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"),
    re.compile(r"\bRS\s?\d{2}(?:[\s-]?\d){18}\b", re.IGNORECASE),
    re.compile(r"(?<!\d)\d{3}[\s-]?\d{13}[\s-]?\d{2}(?!\d)"),
    re.compile(r"(?<!\d)\d{13}(?!\d)"),
    # Phones, passports, short account notation: 9+ digits with spaces, hyphens, parentheses, slashes.
    # A dot is not treated as a separator so dates like 08.10.2026 are not eaten.
    re.compile(r"(?<![\w])\+?\d(?:[\s()/-]{0,2}\d){8,}(?!\d)"),
)


@dataclass(frozen=True)
class AccountReport:
    bank: str
    city: str
    account_type: str
    result: str
    visit_date: str
    residency: str
    documents: tuple[str, ...]
    comment: str
    branch: str | None = None


def scrub_pii(text: str) -> str:
    """Replaces anything that looks like an email, JMBG, account number, phone or passport with MASK."""
    for pattern in PII_PATTERNS:
        text = pattern.sub(MASK, text)
    return text


def free_text(raw: str) -> str:
    return scrub_pii(" ".join(raw.split())[:FREE_TEXT_MAX])


def match_label(raw: str, names: dict[str, str]) -> str | None:
    """Directory code by code or by label, case-insensitive; None means the value is not in the directory."""
    value = " ".join(raw.split())
    if value in names:
        return value
    wanted = value.casefold()
    return next((code for code, label in names.items() if label.casefold() == wanted), None)


def pick_name(raw: str, names: dict[str, str]) -> str:
    """Directory name or the person's own value, scrubbed of personal data."""
    code = match_label(raw, names)
    return names[code] if code else free_text(raw)


def pick_code(raw: str, names: dict[str, str]) -> str:
    """Directory code or the person's own value, scrubbed of personal data."""
    return match_label(raw, names) or free_text(raw)


def pick_documents(values: list[str]) -> tuple[str, ...]:
    """Directory document codes and own values, without empties and duplicates."""
    picked = [pick_code(value, DOCUMENTS) for value in values]
    unique = [value for value in dict.fromkeys(picked) if value]
    return tuple(unique[:DOCUMENTS_MAX])


def pick_branch(raw: str, branches: tuple[Branch, ...]) -> str | None:
    """Branch from the bank directory or its own name, scrubbed of personal data; None means not given."""
    value = " ".join(raw.split())
    if not value or fold(value) == fold(NOT_SURE):
        return None
    return match_branch(value, branches) or scrub_pii(value[:BRANCH_MAX]).strip() or None


def parse_visit_date(raw: str, today: date) -> str | None:
    """Visit date in ISO; the future (except tomorrow, for time zones) and too old are rejected."""
    try:
        visit = date.fromisoformat(raw.strip())
    except ValueError:
        return None
    if not today - timedelta(days=VISIT_DAYS_BACK) <= visit <= today + timedelta(days=1):
        return None
    return visit.isoformat()


def parse_account_form(
    form: dict[str, str], documents: list[str], today: date, directory: Directory | None = None
) -> tuple[AccountReport, list[str]]:
    """Builds a report from form fields; returns it and a list of errors for the person.

    Bank, city, status, documents and branch arrive as text from fields with suggestions: a name
    from the list is turned into a directory value, a custom one is saved as is after scrubbing.
    """
    bank_code = match_label(form.get("bank", ""), BANKS)
    bank = pick_name(form.get("bank", ""), BANKS)
    city = pick_name(form.get("city", ""), CITIES)
    account_type = form.get("account_type", "")
    result = form.get("result", "")
    visit_date = parse_visit_date(form.get("visit_date", ""), today)
    residency = form.get("residency", "")
    comment = (form.get("comment") or "").strip()
    errors: list[str] = []
    if not bank:
        errors.append("Выберите банк или впишите свой.")
    if not city:
        errors.append("Выберите город или впишите свой.")
    if account_type not in ACCOUNT_TYPES:
        errors.append("Укажите, какой счёт: личный, ИП или оба сразу.")
    if result not in RESULTS:
        errors.append("Укажите, чем закончилось: открыли, отказали или ещё в процессе.")
    if visit_date is None:
        errors.append("Дата визита — не в будущем и не старше года.")
    if len(comment) > COMMENT_MAX:
        errors.append(f"Комментарий длиннее {COMMENT_MAX} знаков.")
    report = AccountReport(
        bank=bank,
        city=city,
        account_type=account_type,
        result=result,
        visit_date=visit_date or "",
        residency=pick_code(residency, RESIDENCIES),
        documents=pick_documents(documents),
        comment=scrub_pii(comment),
        branch=pick_branch(form.get("branch", ""), (directory or {}).get(bank_code or "", ())),
    )
    return report, errors


def labels() -> dict[str, dict[str, str]]:
    """Code labels for those who build a table from the public JSON."""
    return {
        "account_type": ACCOUNT_TYPES,
        "result": RESULTS,
        "residency": RESIDENCIES,
        "documents": DOCUMENTS,
    }
