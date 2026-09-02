from datetime import datetime, timedelta
from unittest.mock import MagicMock

from domain.entities.service import CheckResult, ServiceStatus
from application.use_cases.predict_latency_trend import predict_latency_trend


def _make_checks(latencies):
    base = datetime(2026, 1, 1)
    return [
        CheckResult(
            service_id=1, status=ServiceStatus.UP, response_time_ms=lat, status_code=200,
            error_message=None, checked_at=base + timedelta(minutes=i),
        )
        for i, lat in enumerate(latencies)
    ]


def test_detects_degrading_trend():
    repo = MagicMock()
    repo.get_checks_for_service.return_value = _make_checks([100, 120, 140, 160, 180])

    trend = predict_latency_trend(1, repo, critical_threshold_ms=500)

    assert trend.is_degrading is True
    assert trend.slope_ms_per_check > 0
    assert trend.predicted_checks_to_breach is not None


def test_stable_trend_is_not_degrading():
    repo = MagicMock()
    repo.get_checks_for_service.return_value = _make_checks([100, 100, 100, 100])

    trend = predict_latency_trend(1, repo, critical_threshold_ms=500)

    assert trend.is_degrading is False
    assert trend.predicted_checks_to_breach is None


def test_returns_none_with_insufficient_data():
    repo = MagicMock()
    repo.get_checks_for_service.return_value = _make_checks([100])
    assert predict_latency_trend(1, repo, critical_threshold_ms=500) is None
