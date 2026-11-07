"""Отметки посетителей об очереди в отделениях Poštanska (карта на /vyplata/).

Отметка — одно из четырёх состояний «глазами», без чисел и без персональных данных.
Список отделений — data/postanska_branch_ids.json, часы работы — data/postanska_branch_hours.json
(копии шифр и часов из src/data/postanska-branches.json, сверяет тест). Отметки принимаем в том же окне,
что и кнопка на сайте (canReport в src/lib/branch-hours.mjs): от часа до открытия до часа после закрытия, по Белграду.
Комментарий хранится для модерации и публично не показывается.
"""

import json
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import cache
from importlib.resources import files

from alta_feedback.accounts import scrub_pii

STATES = ("none", "few", "full", "outside")
STATUSES = frozenset({"new", "accepted", "rejected", "test", "spam"})
HIDDEN_STATUSES = ("rejected", "test", "spam")
COMMENT_MAX = 140
FRESH = timedelta(hours=2)
SAME_BRANCH_GAP = timedelta(minutes=15)
# Общий Wi-Fi в отделении и CGNAT у мобильных операторов: десятки людей за одним адресом.
PER_HOUR_LIMIT = 60
# Люди собираются у двери до открытия — отметки принимаем за час.
PRE_OPEN = 60
# Отделение закрывается не ровно в срок, а часы могут продлить — принимаем ещё час после закрытия.
POST_CLOSE = 60
HOURS_RE = re.compile(r"(\d{1,2})[.:](\d{2})h?\s*-\s*(\d{1,2})[.:](\d{2})")
# Телефон или почта в комментарии: такие отметки не принимаем, чтобы не копить контакты.
CONTACT = re.compile(r"@|\d[\d\s()+-]{5,}\d")


@cache
def branch_ids() -> frozenset[str]:
    raw = files("alta_feedback").joinpath("data/postanska_branch_ids.json").read_text("utf-8")
    return frozenset(json.loads(raw))


type Hours = tuple[int, int]


def parse_hours(text: str | None) -> Hours | None:
    """«08:00-15:00» и «8.00h - 15.00h» из PDF AOD → минуты от полуночи."""
    m = HOURS_RE.search(text or "")
    return (int(m[1]) * 60 + int(m[2]), int(m[3]) * 60 + int(m[4])) if m else None


@cache
def branch_hours() -> dict[str, tuple[Hours | None, Hours | None]]:
    raw = json.loads(files("alta_feedback").joinpath("data/postanska_branch_hours.json").read_text("utf-8"))
    return {code: (parse_hours(wd), parse_hours(sat)) for code, (wd, sat) in raw.items()}


def hours_on(weekday: int, wd: Hours | None, sat: Hours | None) -> Hours | None:
    """weekday как у datetime: 0 — пн … 6 — вс."""
    if weekday == 6:
        return None
    return sat if weekday == 5 else wd


@dataclass(frozen=True)
class Closed:
    """Отметки закрыты; откроются в reports_from (чч:мм) через days_ahead дней, weekday — 0 пн … 6 вс."""

    reports_from: str
    days_ahead: int
    weekday: int


def closed_until(branch_id: str, local: datetime) -> Closed | None:
    """None — отметку можно принять; у отделения без часов в данных не мешаем."""
    wd, sat = branch_hours().get(branch_id, (None, None))
    if wd is None and sat is None:
        return None
    minute = local.hour * 60 + local.minute
    today = hours_on(local.weekday(), wd, sat)
    if today and today[0] - PRE_OPEN <= minute < today[1] + POST_CLOSE:
        return None
    for ahead in range(8):
        day = (local.weekday() + ahead) % 7
        hours = hours_on(day, wd, sat)
        if hours and (ahead or minute < hours[0] - PRE_OPEN):
            start = max(hours[0] - PRE_OPEN, 0)
            return Closed(f"{start // 60}:{start % 60:02d}", ahead, day)
    return None


@dataclass(frozen=True)
class QueueReport:
    branch_id: str
    state: str
    comment: str


def parse_report(data: object) -> tuple[QueueReport | None, str | None]:
    """Разбирает тело POST; вторым значением — причина отказа."""
    if not isinstance(data, dict):
        return None, "body"
    branch_id, state = str(data.get("branch_id", "")), str(data.get("state", ""))
    comment = " ".join(str(data.get("comment") or "").split())
    if branch_id not in branch_ids():
        return None, "branch_id"
    if state not in STATES:
        return None, "state"
    if len(comment) > COMMENT_MAX:
        return None, "comment_length"
    if CONTACT.search(comment):
        return None, "comment_contact"
    return QueueReport(branch_id, state, scrub_pii(comment)), None


def summarize(rows: list[tuple[str, str, str]], now: datetime) -> dict[str, dict]:
    """rows — (branch_id, state, created_at ISO) за окно свежести, по возрастанию времени.

    Состояние отделения — самое частое; при равенстве — самое свежее из равных.
    """
    by_branch: dict[str, list[tuple[str, str]]] = {}
    for branch_id, state, created_at in rows:
        by_branch.setdefault(branch_id, []).append((state, created_at))
    summary = {}
    for branch_id, items in by_branch.items():
        counts = Counter(state for state, _ in items)
        top = max(counts.values())
        latest = {state: at for state, at in items}
        state = max((s for s in counts if counts[s] == top), key=lambda s: latest[s])
        updated = max(at for _, at in items)
        minutes = int((now - datetime.fromisoformat(updated)).total_seconds() // 60)
        summary[branch_id] = {"state": state, "count": len(items), "minutes_ago": max(minutes, 0)}
    return summary
