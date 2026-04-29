from unittest.mock import MagicMock
from domain.entities.service import Service, CheckResult, ServiceStatus, Alert
from application.use_cases.send_alert import send_alert


def _make_service():
    return Service(id=1, name="API", url="https://api.example.com", check_interval_seconds=60)


def _make_result(error=None):
    return CheckResult(
        service_id=1,
        status=ServiceStatus.DOWN,
        response_time_ms=None,
        status_code=503,
        error_message=error,
    )


def test_send_alert_calls_notifier():
    notifier = MagicMock()
    send_alert(_make_service(), _make_result(), notifier)
    notifier.send.assert_called_once()


def test_send_alert_message_contains_service_name():
    notifier = MagicMock()
    send_alert(_make_service(), _make_result(), notifier)
    alert: Alert = notifier.send.call_args[0][0]
    assert "API" in alert.message
    assert alert.service_id == 1
