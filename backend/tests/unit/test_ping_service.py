from unittest.mock import MagicMock, patch
import pytest
from domain.entities.service import Service, CheckResult, ServiceStatus
from application.use_cases.ping_service import ping_service


def _make_service(**kwargs):
    defaults = dict(id=1, name="Test", url="https://example.com", check_interval_seconds=60)
    return Service(**{**defaults, **kwargs})


def _make_result(status=ServiceStatus.UP, **kwargs):
    defaults = dict(
        service_id=0,
        status=status,
        response_time_ms=100.0,
        status_code=200,
        error_message=None,
    )
    return CheckResult(**{**defaults, **kwargs})


@pytest.fixture
def repo():
    r = MagicMock()
    r.get_by_id.return_value = _make_service()
    r.get_alert_rules.return_value = []
    return r


@pytest.fixture
def notifier():
    return MagicMock()


def test_ping_service_up_saves_result(repo, notifier):
    result = _make_result(ServiceStatus.UP)
    with patch("application.use_cases.ping_service.ping_url", return_value=result):
        out = ping_service(1, repo, notifier)

    repo.save_check_result.assert_called_once_with(result)
    assert out.status == ServiceStatus.UP


def test_ping_service_up_does_not_alert(repo, notifier):
    result = _make_result(ServiceStatus.UP)
    with patch("application.use_cases.ping_service.ping_url", return_value=result):
        ping_service(1, repo, notifier)

    notifier.send.assert_not_called()


def test_ping_service_down_sends_alert(repo, notifier):
    result = _make_result(ServiceStatus.DOWN, status_code=500, error_message=None)
    with patch("application.use_cases.ping_service.ping_url", return_value=result):
        ping_service(1, repo, notifier)

    notifier.send.assert_called_once()


def test_ping_service_assigns_service_id(repo, notifier):
    result = _make_result(ServiceStatus.UP)
    with patch("application.use_cases.ping_service.ping_url", return_value=result):
        ping_service(1, repo, notifier)

    assert result.service_id == 1


def test_ping_service_raises_when_not_found(notifier):
    repo = MagicMock()
    repo.get_by_id.return_value = None
    with pytest.raises(ValueError, match="not found"):
        with patch("application.use_cases.ping_service.ping_url"):
            ping_service(99, repo, notifier)
