from datetime import datetime, timedelta
from unittest.mock import MagicMock

from domain.entities.service import CheckResult, ServiceStatus
from application.use_cases.calculate_service_stats import (
    calculate_service_stats,
    find_check_by_timestamp_binary,
    find_check_by_timestamp_linear,
)


def _make_checks(statuses, latency=100.0):
    base = datetime(2026, 1, 1)
    return [
        CheckResult(
            service_id=1, status=s, response_time_ms=latency, status_code=200,
            error_message=None, checked_at=base + timedelta(minutes=i),
        )
        for i, s in enumerate(statuses)
    ]


def test_uptime_percentage_calculation():
    repo = MagicMock()
    repo.get_checks_for_service.return_value = _make_checks([ServiceStatus.UP] * 3 + [ServiceStatus.DOWN])
    stats = calculate_service_stats(1, repo)
    assert stats.uptime_percentage == 75.0
    assert stats.total_checks == 4


def test_stats_include_reliability_tier():
    repo = MagicMock()
    repo.get_checks_for_service.return_value = _make_checks([ServiceStatus.UP] * 10)
    stats = calculate_service_stats(1, repo, tier_a1=80.0, tier_d=5.0, tier_n=4)
    assert stats.reliability_tier == "Platinum"


def test_binary_and_linear_search_agree_on_result():
    checks = _make_checks([ServiceStatus.UP] * 20)
    target = checks[10].checked_at
    binary_result, binary_ops = find_check_by_timestamp_binary(checks, target)
    linear_result, linear_ops = find_check_by_timestamp_linear(checks, target)
    assert binary_result.checked_at == linear_result.checked_at == target
    assert binary_ops < linear_ops
