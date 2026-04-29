import requests
from domain.entities.service import CheckResult, ServiceStatus
from datetime import datetime, UTC


def ping_url(url: str, timeout: int = 10) -> CheckResult:
    try:
        start = datetime.now(UTC)
        response = requests.get(url, timeout=timeout)
        elapsed_ms = (datetime.now(UTC) - start).total_seconds() * 1000
        status = ServiceStatus.UP if response.status_code < 400 else ServiceStatus.DOWN
        return CheckResult(
            service_id=0,
            status=status,
            response_time_ms=round(elapsed_ms, 2),
            status_code=response.status_code,
            error_message=None,
            checked_at=datetime.now(UTC),
        )
    except requests.RequestException as e:
        return CheckResult(
            service_id=0,
            status=ServiceStatus.DOWN,
            response_time_ms=None,
            status_code=None,
            error_message=str(e),
            checked_at=datetime.now(UTC),
        )
