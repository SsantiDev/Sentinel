from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from infrastructure.repositories.scheduler_repository import DjangoSchedulerRepository


class IsSuperUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_superuser)


class SchedulerStatusView(APIView):
    """GET /api/v1/scheduler/status/ — dice si el reloj de fondo (turnero)
    sigue vivo: hace cuanto corrio y cuantos servicios encolo la ultima vez."""
    permission_classes = [IsSuperUser]

    def get(self, request):
        run = DjangoSchedulerRepository().get_latest_run()
        seconds_since_last_run = None
        if run.last_run_at:
            seconds_since_last_run = (timezone.now() - run.last_run_at).total_seconds()

        return Response({
            'last_run_at': run.last_run_at.isoformat() if run.last_run_at else None,
            'seconds_since_last_run': seconds_since_last_run,
            'queued_count': run.queued_count,
            'total_scheduled': run.total_scheduled,
        })
