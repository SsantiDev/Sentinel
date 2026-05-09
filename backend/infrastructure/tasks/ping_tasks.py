from config.celery import app
from application.use_cases.ping_service import ping_service
from infrastructure.repositories.service_repository import DjangoServiceRepository
from infrastructure.external.alert_notifier import (
    LogAlertNotifier, EmailAlertNotifier, SlackAlertNotifier, CompositeAlertNotifier,
)
from infrastructure.models import ServiceModel


from infrastructure.config_manager import ConfigManager


def _build_notifier() -> CompositeAlertNotifier:
    return CompositeAlertNotifier([
        LogAlertNotifier(),
        EmailAlertNotifier(),
        SlackAlertNotifier(),
    ])


@app.task(bind=True, max_retries=3)
def ping_service_task(self, service_id: int):
    config = ConfigManager.get_config()
    if config.get('system', {}).get('maintenance_mode', False):
        return {"status": "skipped", "reason": "maintenance mode"}

    repo = DjangoServiceRepository()
    notifier = _build_notifier()
    try:
        res = ping_service(service_id, repo, notifier)
        return {
            "service_id": service_id,
            "status": res.status.value,
            "response_time": res.response_time_ms
        }
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


@app.task
def schedule_all_pings():
    config = ConfigManager.get_config()
    if config.get('system', {}).get('maintenance_mode', False):
        return

    ids = ServiceModel.objects.filter(is_active=True).values_list('id', flat=True)
    for sid in ids:
        ping_service_task.delay(sid)
