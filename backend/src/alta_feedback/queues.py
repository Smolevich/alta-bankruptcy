"""Отметки посетителей об очереди в отделениях Poštanska (карта на /vyplata/).

Отметка — одно из четырёх состояний «глазами», без чисел и без персональных данных.
Список отделений — data/postanska_branch_ids.json (копия шифр из src/data/postanska-branches.json,
сверяет тест). Комментарий хранится для модерации и публично не показывается.
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
PER_HOUR_LIMIT = 12
# Телефон или почта в комментарии: такие отметки не принимаем, чтобы не копить контакты.
CONTACT = re.compile(r"@|\d[\d\s()+-]{5,}\d")


@cache
def branch_ids() -> frozenset[str]:
    raw = files("alta_feedback").joinpath("data/postanska_branch_ids.json").read_text("utf-8")
    return frozenset(json.loads(raw))


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
