from typing import List, Optional
from domain.entities.service import Service, CheckResult, ServiceStatus
from domain.interfaces.service_repository import IServiceRepository
from infrastructure.models import ServiceModel, CheckResultModel


class DjangoServiceRepository(IServiceRepository):
    def get_all_active(self) -> List[Service]:
        return [self._to_entity(m) for m in ServiceModel.objects.filter(is_active=True)]

    def get_by_id(self, service_id: int) -> Optional[Service]:
        try:
            return self._to_entity(ServiceModel.objects.get(pk=service_id))
        except ServiceModel.DoesNotExist:
            return None

    def save(self, service: Service) -> Service:
        if service.id:
            m = ServiceModel.objects.get(pk=service.id)
            m.name = service.name
            m.url = service.url
            m.check_interval_seconds = service.check_interval_seconds
            m.is_active = service.is_active
            m.save()
        else:
            m = ServiceModel.objects.create(
                name=service.name,
                url=service.url,
                check_interval_seconds=service.check_interval_seconds,
                is_active=service.is_active,
            )
        return self._to_entity(m)

    def save_check_result(self, result: CheckResult) -> None:
        CheckResultModel.objects.create(
            service_id=result.service_id,
            status=result.status.value,
            response_time_ms=result.response_time_ms,
            status_code=result.status_code,
            error_message=result.error_message,
        )

    def _to_entity(self, m: ServiceModel) -> Service:
        return Service(
            id=m.pk,
            name=m.name,
            url=m.url,
            check_interval_seconds=m.check_interval_seconds,
            is_active=m.is_active,
            created_at=m.created_at,
        )
