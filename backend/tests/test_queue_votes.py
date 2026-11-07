import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from alta_feedback import queues
from alta_feedback.queues import Vote, summarize

NOW = datetime(2026, 11, 11, 9, tzinfo=UTC)
SITE_EXTRA = Path(__file__).parents[2] / "src/data/postanska-branches-extra.json"
# 754 BEOGRAD 30 - CENTAR
BRANCH = "754"


def at(minutes_ago: int) -> str:
    return (NOW - timedelta(minutes=minutes_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")


def vote(voter: str, state: str, minutes_ago: int, near: bool = False) -> Vote:
    return Vote(BRANCH, state, at(minutes_ago), voter, near)


def shown(*votes: Vote) -> dict:
    return summarize(sorted(votes, key=lambda v: v.created_at), NOW)[BRANCH]


def test_one_person_repeating_counts_once():
    assert shown(vote("a", "full", 30), vote("a", "full", 20), vote("a", "full", 10))["count"] == 1


def test_repeating_person_cannot_outvote_another():
    spam = [vote("a", "outside", m) for m in (40, 30, 20)]
    assert shown(*spam, vote("b", "none", 5), vote("c", "none", 6))["state"] == "none"


def test_latest_mark_of_a_person_replaces_earlier():
    assert shown(vote("a", "full", 30), vote("a", "none", 5))["state"] == "none"


def test_two_agreeing_with_one_near_is_sure():
    assert shown(vote("a", "few", 20, near=True), vote("b", "few", 10))["sure"] is True


def test_two_agreeing_both_far_is_not_sure():
    assert shown(vote("a", "few", 20), vote("b", "few", 10))["sure"] is False


def test_one_near_person_alone_is_not_sure():
    assert shown(vote("a", "few", 10, near=True))["sure"] is False


def test_same_person_twice_near_is_not_sure():
    assert shown(vote("a", "few", 20, near=True), vote("a", "few", 10, near=True))["sure"] is False


def test_near_marks_decide_state_over_far_majority():
    far = [vote(v, "outside", 10) for v in "abc"]
    assert shown(*far, vote("d", "none", 15, near=True))["state"] == "none"


def test_without_near_marks_state_comes_from_all_but_is_not_sure():
    result = shown(vote("a", "full", 10), vote("b", "full", 12), vote("c", "none", 5))
    assert (result["state"], result["count"], result["sure"]) == ("full", 3, False)


@pytest.mark.parametrize(("meters", "near"), [(0, True), (490, True), (510, False), (3000, False)])
def test_near_means_within_500_metres(meters, near):
    lat, lng = queues.branch_coords()[BRANCH]
    north = lat + meters / 111_195
    assert queues.near_branch(BRANCH, {"lat": north, "lng": lng}) is near


BAD_COORDS = [{}, {"lat": "44.8", "lng": 20.4}, {"lat": 95, "lng": 20}, {"lat": True, "lng": 1}]


@pytest.mark.parametrize("data", BAD_COORDS)
def test_missing_or_bad_coordinates_mean_unknown(data):
    assert queues.near_branch(BRANCH, data) is None


def test_branch_coords_copy_matches_site_data():
    site = json.loads(SITE_EXTRA.read_text("utf-8"))
    assert queues.branch_coords() == {code: (b["lat"], b["lng"]) for code, b in site.items()}


def test_every_branch_has_coordinates():
    assert queues.branch_ids() <= queues.branch_coords().keys()


def test_tie_nearby_is_mixed_not_the_fresher_state():
    summary = shown(vote("a", "few", 30, near=True), vote("b", "full", 5, near=True))
    assert (summary["state"], summary["sure"]) == ("mixed", False)


def test_tie_lists_votes_per_state():
    summary = shown(vote("a", "few", 30, near=True), vote("b", "full", 5, near=True))
    assert summary["split"] == {"few": 1, "full": 1}


def test_majority_of_two_over_one_wins():
    assert shown(vote("a", "full", 30), vote("b", "full", 20), vote("c", "none", 5))["state"] == "full"


def test_far_tie_is_settled_by_a_single_near_vote():
    far = [vote("a", "few", 30), vote("b", "full", 20)]
    assert shown(*far, vote("c", "none", 25, near=True))["state"] == "none"


def test_far_tie_without_near_votes_is_mixed():
    assert shown(vote("a", "few", 30), vote("b", "full", 5))["state"] == "mixed"


def test_clear_state_has_no_split():
    assert "split" not in shown(vote("a", "few", 30), vote("b", "few", 5))
