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

    # Evaluate Alert Rules
    rules = repo.get_alert_rules(service_id)
    
    # If no rules exist, we use a default behavior (global alert)
    if not rules and result.status == ServiceStatus.DOWN:
        from application.use_cases.send_alert import send_alert
        send_alert(service, result, notifier, alert_type='down')
        return result

    for rule in rules:
        should_alert = False
        
        if rule.condition == 'consecutive_failures' and result.status == ServiceStatus.DOWN:
            failure_count = repo.get_consecutive_failures(service_id)
            if failure_count >= rule.threshold:
                should_alert = True
        
        elif rule.condition == 'latency_above':
            if result.response_time_ms and result.response_time_ms >= rule.threshold:
                should_alert = True

        if should_alert:
            from application.use_cases.send_alert import send_alert
            # We pass the rule's contact to send_alert
            send_alert(
                service, 
                result, 
                notifier, 
                recipient=rule.contact, 
                alert_type=rule.condition,
                threshold=rule.threshold
            )

    return result
