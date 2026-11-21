from datetime import UTC, datetime, timedelta

from alta_feedback.pow import create_challenge, derive_key, encode_payload, solve, verify_payload

KEY = derive_key("salt")
NOW = datetime(2026, 11, 1, 12, tzinfo=UTC)


def solved(key: bytes = KEY, number: int = 7) -> str:
    challenge = create_challenge(key, NOW, maxnumber=20, number=number)
    return encode_payload(challenge, solve(challenge))


def test_valid_solution_passes() -> None:
    assert verify_payload(KEY, solved(), NOW) is not None


def test_solution_signed_with_other_key_fails() -> None:
    assert verify_payload(KEY, solved(key=derive_key("other")), NOW) is None


def test_expired_solution_fails() -> None:
    assert verify_payload(KEY, solved(), NOW + timedelta(hours=1)) is None


def test_wrong_number_fails() -> None:
    challenge = create_challenge(KEY, NOW, maxnumber=20, number=7)
    assert verify_payload(KEY, encode_payload(challenge, 8), NOW) is None


def test_garbage_payload_fails() -> None:
    assert verify_payload(KEY, "не base64 {", NOW) is None


def test_solver_finds_the_hidden_number() -> None:
    assert solve(create_challenge(KEY, NOW, maxnumber=20, number=13)) == 13
