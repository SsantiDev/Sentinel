from datetime import datetime, timedelta
from typing import List, Optional

from domain.entities.membership import UsageEvent, UsageAnomaly


def check_sliding_window(
    events: List[UsageEvent],
    window_seconds: int,
    threshold: int,
    now: Optional[datetime] = None,
) -> Optional[UsageAnomaly]:
    now = now or datetime.utcnow()
    window_start = now - timedelta(seconds=window_seconds)

    in_window = [e for e in events if e.occurred_at >= window_start]
    count = len(in_window)

    if count < threshold:
        return None

    return UsageAnomaly(
        user_id=in_window[0].user_id,
        event_count=count,
        window_seconds=window_seconds,
        threshold=threshold,
    )
