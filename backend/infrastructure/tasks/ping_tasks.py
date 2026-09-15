import logging
from django.utils import timezone
from config.celery import app
from application.use_cases.ping_service import ping_service
from application.use_cases.select_due_checks import select_due_checks
from infrastructure.repositories.service_repository import DjangoServiceRepository
from infrastructure.repositories.scheduler_repository import DjangoSchedulerRepository
from infrastructure.external.alert_notifier import (
    LogAlertNotifier, EmailAlertNotifier, SlackAlertNotifier, CompositeAlertNotifier,
)
from infrastructure.config_manager import ConfigManager

logger = logging.getLogger(__name__)

# Cada cuanto corre schedule_all_pings (ver CELERY_BEAT_SCHEDULE en settings).
# Se usa como horizonte del turnero: incluye lo que vence antes de la proxima corrida.
SCHEDULER_TICK_SECONDS = 60.0


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

    repo = DjangoServiceRepository()
    selection = select_due_checks(
        repo.get_scheduling_candidates(),
        timezone.now(),
        lookahead_seconds=SCHEDULER_TICK_SECONDS,
    )
    for service_id in selection.due_service_ids:  # array de ids vencidos (salio del heap)
        ping_service_task.delay(service_id)  # mete un trabajo en la cola de Redis/Celery; el worker lo ejecuta de fondo

    DjangoSchedulerRepository().record_run(
        queued_count=len(selection.due_service_ids),
        total_scheduled=selection.total_scheduled,
    )

    logger.info(
        "Turnero: %d/%d servicios vencidos encolados (%d operaciones)",
        len(selection.due_service_ids),
        selection.total_scheduled,
        selection.operations_count,
    )


@app.task
def purge_trial_user_data():
    from datetime import timedelta
    from django.contrib.auth import get_user_model
    from infrastructure.models import CheckResultModel

    cutoff = timezone.now() - timedelta(days=2)
    User = get_user_model()

    trial_owner_ids = User.objects.filter(
        is_staff=False, is_superuser=False
    ).values_list('id', flat=True)

    deleted, _ = CheckResultModel.objects.filter(
        service__owner_id__in=trial_owner_ids,
        checked_at__lt=cutoff,
    ).delete()

    logger.info("Purged %d check results for trial users (older than 2 days)", deleted)
