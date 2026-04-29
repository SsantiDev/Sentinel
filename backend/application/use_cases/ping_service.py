from domain.entities.service import CheckResult, ServiceStatus
from domain.interfaces.service_repository import IServiceRepository
from domain.interfaces.alert_notifier import IAlertNotifier
from infrastructure.external.http_client import ping_url
from datetime import datetime


def ping_service(service_id: int, repo: IServiceRepository, notifier: IAlertNotifier) -> CheckResult:
    service = repo.get_by_id(service_id)
    if not service:
        raise ValueError(f"Service {service_id} not found")

    result = ping_url(service.url)
    result.service_id = service_id
    repo.save_check_result(result)

    if result.status == ServiceStatus.DOWN:
        from application.use_cases.send_alert import send_alert
        send_alert(service, result, notifier)

    return result
