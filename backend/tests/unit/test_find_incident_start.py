from datetime import datetime, timedelta
from unittest.mock import MagicMock

from domain.entities.service import CheckResult, ServiceStatus
from application.use_cases.find_incident_start import find_incident_start


def _make_checks(statuses):
    base = datetime(2026, 1, 1)
    return [
        CheckResult(
            service_id=1, status=s, response_time_ms=100.0, status_code=200,
            error_message=None, checked_at=base + timedelta(minutes=i),
        )
        for i, s in enumerate(statuses)
    ]


def test_no_incident_when_last_check_is_up():
    repo = MagicMock()
    repo.get_checks_for_service.return_value = _make_checks([ServiceStatus.UP, ServiceStatus.UP])
    assert find_incident_start(1, repo) is None


def test_finds_start_of_ongoing_incident():
    repo = MagicMock()
    checks = _make_checks(
        [ServiceStatus.UP, ServiceStatus.UP, ServiceStatus.DOWN, ServiceStatus.DOWN, ServiceStatus.DOWN]
    )
    repo.get_checks_for_service.return_value = checks

    incident = find_incident_start(1, repo)

    assert incident.start_check == checks[2]
    assert incident.is_ongoing is True


def test_operations_count_is_logarithmic():
    repo = MagicMock()
    checks = _make_checks([ServiceStatus.UP] * 7 + [ServiceStatus.DOWN] * 9)
    repo.get_checks_for_service.return_value = checks

    incident = find_incident_start(1, repo)

    assert incident.operations_count <= 5  # log2(16) ~ 4
