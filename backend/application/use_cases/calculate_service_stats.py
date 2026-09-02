from datetime import datetime
from typing import List, Optional, Tuple

from domain.entities.analytics import ServiceStats
from domain.entities.service import CheckResult, ServiceStatus
from domain.interfaces.service_repository import IServiceRepository
from application.use_cases.calculate_reliability_tier import calculate_reliability_tier


def _percentile(sorted_values: List[float], pct: float) -> float:
    if not sorted_values:
        return 0.0
    index = min(len(sorted_values) - 1, int(len(sorted_values) * pct))
    return sorted_values[index]


def calculate_service_stats(
    service_id: int,
    repo: IServiceRepository,
    tier_a1: float = 80.0,
    tier_d: float = 5.0,
    tier_n: int = 4,
    window: int = 500,
) -> ServiceStats:
    checks = repo.get_checks_for_service(service_id, limit=window)
    total = len(checks)
    up_count = sum(1 for c in checks if c.status == ServiceStatus.UP)
    uptime_pct = (up_count / total * 100) if total else 0.0

    latencies = sorted(c.response_time_ms for c in checks if c.response_time_ms is not None)
    avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else None
    p95_latency = round(_percentile(latencies, 0.95), 2) if latencies else None

    tier = calculate_reliability_tier(uptime_pct, tier_a1, tier_d, tier_n)

    return ServiceStats(
        service_id=service_id,
        uptime_percentage=round(uptime_pct, 2),
        average_latency_ms=avg_latency,
        p95_latency_ms=p95_latency,
        total_checks=total,
        reliability_tier=tier,
    )


def find_check_by_timestamp_binary(
    checks: List[CheckResult], target: datetime
) -> Tuple[Optional[CheckResult], int]:
    """Busca el check mas cercano a target sobre lista ordenada ascendente por checked_at.
    O(log n) — mejor caso O(1) (match en el primer mid), peor caso O(log n)."""
    lo, hi = 0, len(checks) - 1
    operations = 0
    best = None
    while lo <= hi:
        operations += 1
        mid = (lo + hi) // 2
        best = checks[mid]
        if checks[mid].checked_at == target:
            return checks[mid], operations
        if checks[mid].checked_at < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return best, operations


def find_check_by_timestamp_linear(
    checks: List[CheckResult], target: datetime
) -> Tuple[Optional[CheckResult], int]:
    """Referencia O(n) para benchmark comparativo contra la version binaria.
    Mejor caso O(1) (primer elemento es el mas cercano), peor caso O(n)."""
    best = None
    best_diff = None
    operations = 0
    for check in checks:
        operations += 1
        diff = abs((check.checked_at - target).total_seconds())
        if best_diff is None or diff < best_diff:
            best_diff = diff
            best = check
    return best, operations
