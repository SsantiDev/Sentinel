from datetime import datetime
from typing import List, Optional, Tuple
from django.db.models import Max
from domain.entities.service import Service, CheckResult, ServiceStatus, AlertRule
from domain.interfaces.service_repository import IServiceRepository
from infrastructure.models import ServiceModel, CheckResultModel, AlertRuleModel


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

    def get_alert_rules(self, service_id: int) -> List[AlertRule]:
        return [
            self._to_alert_rule_entity(m)
            for m in AlertRuleModel.objects.filter(service_id=service_id, is_active=True)
        ]

    def get_consecutive_failures(self, service_id: int) -> int:
        # Get last checks, stop counting at first 'up'
        checks = CheckResultModel.objects.filter(service_id=service_id).order_by('-checked_at')[:20]
        count = 0
        for c in checks:
            if c.status == ServiceStatus.DOWN.value:
                count += 1
            else:
                break
        return count

    def get_checks_for_service(self, service_id: int, limit: Optional[int] = None) -> List[CheckResult]:
        # Orden ascendente por checked_at: lo requieren busqueda binaria, biseccion y regresion.
        if limit:
            recent = CheckResultModel.objects.filter(service_id=service_id).order_by('-checked_at')[:limit]
            models = list(reversed(recent))
        else:
            models = list(CheckResultModel.objects.filter(service_id=service_id).order_by('checked_at'))
        return [self._to_check_result_entity(m) for m in models]

    def get_scheduling_candidates(self) -> List[Tuple[int, Optional[datetime], int]]:
        # (service_id, ultimo checked_at, intervalo) por servicio activo.
        # Alimenta la cola de prioridad del turnero (select_due_checks).
        rows = (
            ServiceModel.objects.filter(is_active=True)
            .annotate(last_checked_at=Max('checks__checked_at'))
            .values_list('id', 'last_checked_at', 'check_interval_seconds')
        )
        return list(rows)

    def _to_entity(self, m: ServiceModel) -> Service:
        return Service(
            id=m.pk,
            name=m.name,
            url=m.url,
            check_interval_seconds=m.check_interval_seconds,
            is_active=m.is_active,
            created_at=m.created_at,
        )

    def _to_check_result_entity(self, m: CheckResultModel) -> CheckResult:
        return CheckResult(
            id=m.pk,
            service_id=m.service_id,
            status=ServiceStatus(m.status),
            response_time_ms=m.response_time_ms,
            status_code=m.status_code,
            error_message=m.error_message,
            checked_at=m.checked_at,
        )

    def _to_alert_rule_entity(self, m: AlertRuleModel) -> AlertRule:
        return AlertRule(
            id=m.pk,
            service_id=m.service_id,
            condition=m.condition,
            threshold=m.threshold,
            channel=m.channel,
            contact=m.contact,
            is_active=m.is_active,
        )
