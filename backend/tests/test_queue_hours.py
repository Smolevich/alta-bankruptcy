from datetime import datetime

import pytest

from alta_feedback import queues
from alta_feedback.queues import Closed, closed_until

# 759 BEOGRAD 31 - ĐERAM: будни 8.00h - 17.00h, суббота 8.00h - 13.00h. 11.11.2026 — среда.
BRANCH = "759"


def at(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 11, day, hour, minute)


def test_open_branch_accepts_marks():
    assert closed_until(BRANCH, at(11, 12)) is None


def test_marks_open_an_hour_before_opening():
    assert closed_until(BRANCH, at(11, 7)) is None


def test_one_minute_earlier_is_refused_until_seven_today():
    assert closed_until(BRANCH, at(11, 6, 59)) == Closed("7:00", 0, 2)


def test_last_minute_before_closing_is_accepted():
    assert closed_until(BRANCH, at(11, 16, 59)) is None


def test_hour_after_closing_is_still_accepted():
    assert closed_until(BRANCH, at(11, 17)) is None
    assert closed_until(BRANCH, at(11, 17, 59)) is None


def test_an_hour_after_closing_is_refused_until_tomorrow():
    assert closed_until(BRANCH, at(11, 18)) == Closed("7:00", 1, 3)


def test_saturday_hour_after_one_is_accepted():
    assert closed_until(BRANCH, at(7, 13, 59)) is None


def test_saturday_after_one_waits_for_monday():
    assert closed_until(BRANCH, at(7, 15, 20)) == Closed("7:00", 2, 0)


def test_sunday_waits_for_monday():
    assert closed_until(BRANCH, at(8, 10)) == Closed("7:00", 1, 0)


def test_branch_without_hours_is_not_blocked(monkeypatch):
    monkeypatch.setattr(queues, "branch_hours", lambda: {"x": (None, None)})
    assert closed_until("x", at(8, 3)) is None


@pytest.mark.parametrize("text", ["08:00-15:00", "8.00h - 15.00h"])
def test_both_pdf_hour_formats_parse(text):
    assert queues.parse_hours(text) == (480, 900)
