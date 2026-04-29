from config.celery import app
from application.use_cases.ping_service import ping_service
from infrastructure.repositories.service_repository import DjangoServiceRepository
from infrastructure.external.alert_notifier import (
    LogAlertNotifier, EmailAlertNotifier, SlackAlertNotifier, CompositeAlertNotifier,
)
from infrastructure.models import ServiceModel


def _build_notifier() -> CompositeAlertNotifier:
    return CompositeAlertNotifier([
        LogAlertNotifier(),
        EmailAlertNotifier(),
        SlackAlertNotifier(),
    ])


@app.task(bind=True, max_retries=3)
def ping_service_task(self, service_id: int):
    repo = DjangoServiceRepository()
    notifier = _build_notifier()
    try:
        return ping_service(service_id, repo, notifier)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


@app.task
def schedule_all_pings():
    ids = ServiceModel.objects.filter(is_active=True).values_list('id', flat=True)
    for sid in ids:
        ping_service_task.delay(sid)
