from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Plan:
    id: Optional[int]
    name: str
    max_checks_per_window: int
    window_seconds: int
    is_active: bool = True


@dataclass
class Subscription:
    id: Optional[int]
    user_id: int
    plan: Plan
    status: str = 'active'
    started_at: Optional[datetime] = None


@dataclass
class UsageEvent:
    user_id: int
    event_type: str
    occurred_at: datetime
    id: Optional[int] = None


@dataclass
class UsageAnomaly:
    user_id: int
    event_count: int
    window_seconds: int
    threshold: int
    status: str = 'open'
    id: Optional[int] = None
    detected_at: Optional[datetime] = None
