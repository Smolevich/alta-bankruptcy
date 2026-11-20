"""Visitor marks about queues at Poštanska branches (map on /vyplata/).

A mark is one of four states judged by eye, with no numbers and no personal data.
Branch list: data/postanska_branch_ids.json, opening hours: data/postanska_branch_hours.json
(copies of the branch codes and hours from src/data/postanska-branches.json, checked by a test).
Marks are accepted in the same window as the site button (canReport in src/lib/branch-hours.mjs):
from one hour before opening to one hour after closing, Belgrade time.
The comment is kept for moderation and never shown publicly.

We count people, not marks: the voter is the hash of the browser's localStorage device_id, or of
the IP without it; within the FRESH window only each voter's last mark per branch counts.
Visitor coordinates arrive only to decide "is the visitor nearby" (NEAR_M from the branch; branch
coordinates are in data/postanska_branch_coords.json, a copy of
src/data/postanska-branches-extra.json); only that flag is stored.
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
# Shared Wi-Fi at a branch and carrier CGNAT: dozens of people behind one address.
PER_HOUR_LIMIT = 60
# People gather at the door before opening, so marks are accepted an hour earlier.
PRE_OPEN = 60
# A branch does not close exactly on time and hours can be extended, so accept one more hour after closing.
POST_CLOSE = 60
HOURS_RE = re.compile(r"(\d{1,2})[.:](\d{2})h?\s*-\s*(\d{1,2})[.:](\d{2})")
# A phone number or email in a comment: such marks are rejected so we do not collect contacts.
CONTACT = re.compile(r"@|\d[\d\s()+-]{5,}\d")
# The person is in the branch or at its door; farther away they may not be there.
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
    """Haversine distance, meters."""
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * EARTH_M * math.asin(math.sqrt(h))


def near_branch(branch_id: str, data: dict) -> bool | None:
    """None: coordinates are missing or not numbers; the coordinates themselves go no further than this
    function."""
    lat, lng = data.get("lat"), data.get("lng")
    if not all(isinstance(v, int | float) and not isinstance(v, bool) for v in (lat, lng)):
        return None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180) or branch_id not in branch_coords():
        return None
    return distance_m((lat, lng), branch_coords()[branch_id]) <= NEAR_M


type Hours = tuple[int, int]


def parse_hours(text: str | None) -> Hours | None:
    """'08:00-15:00' and '8.00h - 15.00h' from the AOD PDF -> minutes from midnight."""
    m = HOURS_RE.search(text or "")
    return (int(m[1]) * 60 + int(m[2]), int(m[3]) * 60 + int(m[4])) if m else None


@cache
def branch_hours() -> dict[str, tuple[Hours | None, Hours | None]]:
    raw = json.loads(files("alta_feedback").joinpath("data/postanska_branch_hours.json").read_text("utf-8"))
    return {code: (parse_hours(wd), parse_hours(sat)) for code, (wd, sat) in raw.items()}


def hours_on(weekday: int, wd: Hours | None, sat: Hours | None) -> Hours | None:
    """weekday as in datetime: 0 is Mon ... 6 is Sun."""
    if weekday == 6:
        return None
    return sat if weekday == 5 else wd


@dataclass(frozen=True)
class Closed:
    """Marks are closed; they open at reports_from (hh:mm) in days_ahead days, weekday: 0 Mon ... 6 Sun."""

    reports_from: str
    days_ahead: int
    weekday: int


def closed_until(branch_id: str, local: datetime) -> Closed | None:
    """None: the mark can be accepted; a branch with no hours in the data is not blocked."""
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
    """Parses the POST body; the second value is the rejection reason."""
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
    """Each voter's last mark per branch; rows are in ascending time order."""
    last: dict[tuple[str, str], Vote] = {}
    for vote in rows:
        last.pop((vote.branch_id, vote.voter), None)
        last[(vote.branch_id, vote.voter)] = vote
    by_branch: dict[str, list[Vote]] = {}
    for vote in last.values():
        by_branch.setdefault(vote.branch_id, []).append(vote)
    return by_branch


def branch_summary(votes: list[Vote], now: datetime) -> dict:
    """State is the most frequent among nearby people, or among everyone if no one is nearby.

    A tie among the top states is "mixed" (opinions differ); "split" is how many votes each has.
    "Sure" is set only when two different people chose the state and at least one of them is nearby.
    """
    near = [v for v in votes if v.near]
    pool = near or votes
    counts = Counter(v.state for v in pool)
    top = max(counts.values())
    leaders = [s for s in counts if counts[s] == top]
    updated = max(v.created_at for v in pool)
    minutes = int((now - datetime.fromisoformat(updated)).total_seconds() // 60)
    summary = {"state": leaders[0], "count": len(pool), "minutes_ago": max(minutes, 0), "sure": False}
    if len(leaders) > 1:
        return summary | {"state": "mixed", "split": {s: counts[s] for s in STATES if s in counts}}
    agree = [v for v in votes if v.state == leaders[0]]
    return summary | {"sure": len(agree) >= 2 and any(v.near for v in agree)}


def summarize(rows: list[Vote], now: datetime) -> dict[str, dict]:
    """rows: marks within the freshness window in ascending time order; count: how many people are counted."""
    return {branch_id: branch_summary(votes, now) for branch_id, votes in latest_votes(rows).items()}
