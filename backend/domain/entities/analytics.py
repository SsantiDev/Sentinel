from dataclasses import dataclass
from typing import Optional

from domain.entities.service import CheckResult


@dataclass
class ServiceStats:
    service_id: int
    uptime_percentage: float
    average_latency_ms: Optional[float]
    p95_latency_ms: Optional[float]
    total_checks: int
    reliability_tier: str


@dataclass
class IncidentPeriod:
    service_id: int
    start_check: CheckResult
    is_ongoing: bool
    operations_count: int


@dataclass
class LatencyTrend:
    service_id: int
    slope_ms_per_check: float
    intercept_ms: float
    is_degrading: bool
    predicted_checks_to_breach: Optional[int]
