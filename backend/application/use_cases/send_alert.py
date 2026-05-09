from typing import Optional
from domain.entities.service import Service, CheckResult, Alert
from domain.interfaces.alert_notifier import IAlertNotifier
from datetime import datetime, UTC
from infrastructure.config_manager import ConfigManager


def send_alert(
    service: Service, 
    result: CheckResult, 
    notifier: IAlertNotifier, 
    recipient: Optional[str] = None,
    alert_type: str = 'down',
    threshold: Optional[float] = None
) -> None:
    # Verificar si las alertas globales están habilitadas
    config = ConfigManager.get_config()
    if not config.get('notifications', {}).get('alert_on_failure', True):
        return

    alert = Alert(
        service_id=service.id,
        service_name=service.name,
        service_url=service.url,
        status=result.status.value,
        message=f"Sentinel Detectó una Alerta de {alert_type.replace('_', ' ').title()}",
        alert_type=alert_type,
        recipient=recipient,
        response_time_ms=result.response_time_ms,
        error_message=result.error_message or "Sin mensaje de error detallado",
        condition_threshold=threshold,
        checked_at=result.checked_at,
        sent_at=datetime.now(UTC),
    )
    notifier.send(alert)
