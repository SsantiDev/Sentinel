from dataclasses import dataclass
from datetime import timedelta

from django.utils import timezone

from domain.entities.membership import UsageEvent
from domain.interfaces.membership_repository import IMembershipRepository
from application.use_cases.check_sliding_window import check_sliding_window


@dataclass
class UsageEventResult:
    event: UsageEvent
    anomaly_detected: bool
    limit_exceeded: bool


def record_usage_event(
    user_id: int,
    event_type: str,
    repo: IMembershipRepository,
) -> UsageEventResult:
    subscription = repo.get_subscription_for_user(user_id)
    plan = subscription.plan

    now = timezone.now()
    event = repo.save_usage_event(
        UsageEvent(user_id=user_id, event_type=event_type, occurred_at=now)
    )

    since = now - timedelta(seconds=plan.window_seconds)
    recent_events = repo.get_recent_usage_events(user_id, since)

    anomaly = check_sliding_window(
        recent_events,
        window_seconds=plan.window_seconds,
        threshold=plan.max_checks_per_window,
        now=now,
    )

    if anomaly:
        repo.save_usage_anomaly(anomaly)

    return UsageEventResult(
        event=event,
        anomaly_detected=anomaly is not None,
        limit_exceeded=anomaly is not None,
    )
