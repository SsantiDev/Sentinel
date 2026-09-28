from datetime import datetime, timedelta

from application.use_cases.check_sliding_window import check_sliding_window
from domain.entities.membership import UsageEvent


def test_events_spread_out_no_anomaly():
    now = datetime(2026, 1, 1, 10, 0, 0)
    events = [
        UsageEvent(user_id=1, event_type='api_call', occurred_at=now - timedelta(seconds=50)),
        UsageEvent(user_id=1, event_type='api_call', occurred_at=now - timedelta(seconds=30)),
        UsageEvent(user_id=1, event_type='api_call', occurred_at=now - timedelta(seconds=10)),
    ]
    result = check_sliding_window(events, window_seconds=5, threshold=3, now=now)
    assert result is None


def test_events_concentrated_in_window_triggers_anomaly():
    now = datetime(2026, 1, 1, 10, 0, 3)
    events = [
        UsageEvent(user_id=1, event_type='api_call', occurred_at=datetime(2026, 1, 1, 10, 0, 1)),
        UsageEvent(user_id=1, event_type='api_call', occurred_at=datetime(2026, 1, 1, 10, 0, 2)),
        UsageEvent(user_id=1, event_type='api_call', occurred_at=datetime(2026, 1, 1, 10, 0, 3)),
    ]
    result = check_sliding_window(events, window_seconds=3, threshold=3, now=now)
    assert result is not None
    assert result.user_id == 1
    assert result.event_count == 3


def test_windows_are_independent_per_user():
    now = datetime(2026, 1, 1, 10, 0, 3)
    user_a_events = [
        UsageEvent(user_id=1, event_type='api_call', occurred_at=datetime(2026, 1, 1, 10, 0, 1)),
        UsageEvent(user_id=1, event_type='api_call', occurred_at=datetime(2026, 1, 1, 10, 0, 2)),
        UsageEvent(user_id=1, event_type='api_call', occurred_at=datetime(2026, 1, 1, 10, 0, 3)),
    ]
    user_b_events = [
        UsageEvent(user_id=2, event_type='api_call', occurred_at=datetime(2026, 1, 1, 10, 0, 1)),
    ]

    result_a = check_sliding_window(user_a_events, window_seconds=3, threshold=3, now=now)
    result_b = check_sliding_window(user_b_events, window_seconds=3, threshold=3, now=now)

    assert result_a is not None
    assert result_a.user_id == 1
    assert result_b is None
