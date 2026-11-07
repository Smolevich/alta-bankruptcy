"""Отметки посетителей об очереди в отделениях Poštanska (карта на /vyplata/).

Отметка — одно из четырёх состояний «глазами», без чисел и без персональных данных.
Список отделений — data/postanska_branch_ids.json, часы работы — data/postanska_branch_hours.json
(копии шифр и часов из src/data/postanska-branches.json, сверяет тест). Отметки принимаем в том же окне,
что и кнопка на сайте (canReport в src/lib/branch-hours.mjs):
от часа до открытия до часа после закрытия, по Белграду.
Комментарий хранится для модерации и публично не показывается.

Считаем людей, а не отметки: голосующий — хэш device_id из localStorage браузера, без него — хэш IP;
в окне FRESH у каждого голосующего по отделению в счёт идёт только последняя отметка.
Координаты посетителя приходят только чтобы решить «рядом ли» (NEAR_M до отделения, координаты отделений —
data/postanska_branch_coords.json, копия из src/data/postanska-branches-extra.json); храним лишь этот флаг.
"""

import json
import math
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
# Человек в отделении или у его двери; дальше — может, и не там.
NEAR_M = 500
DEVICE_RE = re.compile(r"[A-Za-z0-9-]{16,64}")
EARTH_M = 6371000


@cache
def branch_ids() -> frozenset[str]:
    raw = files("alta_feedback").joinpath("data/postanska_branch_ids.json").read_text("utf-8")
    return frozenset(json.loads(raw))


@cache
def branch_coords() -> dict[str, tuple[float, float]]:
    raw = json.loads(files("alta_feedback").joinpath("data/postanska_branch_coords.json").read_text("utf-8"))
    return {code: (lat, lng) for code, (lat, lng) in raw.items()}


def distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Расстояние по гаверсинусу, метры."""
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * EARTH_M * math.asin(math.sqrt(h))


def near_branch(branch_id: str, data: dict) -> bool | None:
    """None — координат нет или они не числа; сами координаты дальше этой функции не уходят."""
    lat, lng = data.get("lat"), data.get("lng")
    if not all(isinstance(v, int | float) and not isinstance(v, bool) for v in (lat, lng)):
        return None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180) or branch_id not in branch_coords():
        return None
    return distance_m((lat, lng), branch_coords()[branch_id]) <= NEAR_M


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
    device_id: str | None = None
    near: bool | None = None


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
    device = data.get("device_id")
    device_id = device if isinstance(device, str) and DEVICE_RE.fullmatch(device) else None
    return QueueReport(branch_id, state, scrub_pii(comment), device_id, near_branch(branch_id, data)), None


@dataclass(frozen=True)
class Vote:
    branch_id: str
    state: str
    created_at: str
    voter: str
    near: bool


def latest_votes(rows: list[Vote]) -> dict[str, list[Vote]]:
    """Последняя отметка каждого голосующего по отделению; rows — по возрастанию времени."""
    last: dict[tuple[str, str], Vote] = {}
    for vote in rows:
        last.pop((vote.branch_id, vote.voter), None)
        last[(vote.branch_id, vote.voter)] = vote
    by_branch: dict[str, list[Vote]] = {}
    for vote in last.values():
        by_branch.setdefault(vote.branch_id, []).append(vote)
    return by_branch


def branch_summary(votes: list[Vote], now: datetime) -> dict:
    """Состояние — самое частое среди людей рядом, а если рядом никого — среди всех; при равенстве — свежее.

    «Точно» (sure) — только когда это состояние выбрали двое разных и хотя бы один из них рядом.
    """
    near = [v for v in votes if v.near]
    pool = near or votes
    counts = Counter(v.state for v in pool)
    top = max(counts.values())
    latest = {v.state: v.created_at for v in pool}
    state = max((s for s in counts if counts[s] == top), key=lambda s: latest[s])
    agree = [v for v in votes if v.state == state]
    sure = len(agree) >= 2 and any(v.near for v in agree)
    updated = max(v.created_at for v in pool)
    minutes = int((now - datetime.fromisoformat(updated)).total_seconds() // 60)
    return {"state": state, "count": len(pool), "minutes_ago": max(minutes, 0), "sure": sure}


def summarize(rows: list[Vote], now: datetime) -> dict[str, dict]:
    """rows — отметки за окно свежести по возрастанию времени; count — сколько людей в расчёте."""
    return {branch_id: branch_summary(votes, now) for branch_id, votes in latest_votes(rows).items()}
