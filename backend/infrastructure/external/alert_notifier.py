import logging
import requests
from django.core.mail import send_mail
from django.conf import settings
from domain.entities.service import Alert
from domain.interfaces.alert_notifier import IAlertNotifier

logger = logging.getLogger(__name__)


class LogAlertNotifier(IAlertNotifier):
    def send(self, alert: Alert) -> None:
        logger.warning("ALERT service_id=%s: %s", alert.service_id, alert.message)


class EmailAlertNotifier(IAlertNotifier):
    def send(self, alert: Alert) -> None:
        recipients = getattr(settings, 'ALERT_EMAIL_RECIPIENTS', [])
        if not recipients:
            logger.warning("EmailAlertNotifier: no ALERT_EMAIL_RECIPIENTS configured")
            return
        try:
            send_mail(
                subject=f"[Sentinel] Service #{alert.service_id} is DOWN",
                message=alert.message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipients,
                fail_silently=False,
            )
            logger.info("Alert email sent for service_id=%s", alert.service_id)
        except Exception as exc:
            logger.error("Failed to send alert email: %s", exc)


class SlackAlertNotifier(IAlertNotifier):
    def send(self, alert: Alert) -> None:
        webhook_url = getattr(settings, 'SLACK_WEBHOOK_URL', '')
        if not webhook_url:
            return
        try:
            requests.post(webhook_url, json={"text": alert.message}, timeout=5)
            logger.info("Slack alert sent for service_id=%s", alert.service_id)
        except Exception as exc:
            logger.error("Failed to send Slack alert: %s", exc)


class CompositeAlertNotifier(IAlertNotifier):
    """Fans out to all configured notifiers."""
    def __init__(self, notifiers: list[IAlertNotifier]):
        self._notifiers = notifiers

    def send(self, alert: Alert) -> None:
        for notifier in self._notifiers:
            notifier.send(alert)
