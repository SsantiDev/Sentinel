from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class ServiceStatus(str, Enum):
    UP = 'up'
    DOWN = 'down'
    UNKNOWN = 'unknown'


@dataclass
class Service:
    id: Optional[int]
    name: str
    url: str
    check_interval_seconds: int
    is_active: bool = True
    status: ServiceStatus = ServiceStatus.UNKNOWN
    created_at: Optional[datetime] = None


@dataclass
class CheckResult:
    service_id: int
    status: ServiceStatus
    response_time_ms: Optional[float]
    status_code: Optional[int]
    error_message: Optional[str]
    checked_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Alert:
    service_id: int
    message: str
    sent_at: Optional[datetime] = None
