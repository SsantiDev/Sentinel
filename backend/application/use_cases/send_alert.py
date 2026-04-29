from domain.entities.service import Service, CheckResult, Alert
from domain.interfaces.alert_notifier import IAlertNotifier
from datetime import datetime, UTC


def send_alert(service: Service, result: CheckResult, notifier: IAlertNotifier) -> None:
    alert = Alert(
        service_id=service.id,
        message=f"[DOWN] {service.name} ({service.url}) — {result.error_message or result.status_code}",
        sent_at=datetime.now(UTC),
    )
    notifier.send(alert)
