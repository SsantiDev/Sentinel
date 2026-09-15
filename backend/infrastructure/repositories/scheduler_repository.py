from django.utils import timezone

from domain.entities.scheduling import SchedulerRun
from domain.interfaces.scheduler_repository import ISchedulerRepository
from infrastructure.models import SchedulerRunModel

SINGLETON_ID = 1


class DjangoSchedulerRepository(ISchedulerRepository):
    """Implementacion real con la base de datos.

    No guarda historial: siempre pisa la misma fila (SINGLETON_ID = 1),
    porque solo interesa la ultima corrida, no todas.
    """

    def record_run(self, queued_count: int, total_scheduled: int) -> None:
        SchedulerRunModel.objects.update_or_create(
            pk=SINGLETON_ID,
            defaults={
                'last_run_at': timezone.now(),
                'queued_count': queued_count,
                'total_scheduled': total_scheduled,
            },
        )

    def get_latest_run(self) -> SchedulerRun:
        run = SchedulerRunModel.objects.filter(pk=SINGLETON_ID).first()
        if run is None:
            return SchedulerRun(last_run_at=None, queued_count=0, total_scheduled=0)
        return SchedulerRun(
            last_run_at=run.last_run_at,
            queued_count=run.queued_count,
            total_scheduled=run.total_scheduled,
        )
