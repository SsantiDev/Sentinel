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


from django.template.loader import render_to_string


from infrastructure.config_manager import ConfigManager

class EmailAlertNotifier(IAlertNotifier):
    def send(self, alert: Alert) -> None:
        # Priority: alert.recipient -> global_email from config -> settings.ALERT_EMAIL_RECIPIENTS
        recipients = []
        if alert.recipient and alert.recipient.strip():
            recipients = [alert.recipient]
        else:
            config = ConfigManager.get_config()
            global_email = config.get("notifications", {}).get("global_email")
            if global_email:
                recipients = [global_email]
            else:
                recipients = getattr(settings, 'ALERT_EMAIL_RECIPIENTS', [])

        if not recipients:
            logger.warning("EmailAlertNotifier: no recipients found for alert")
            return
            
        try:
            # Determine dynamic subject based on alert type
            if alert.alert_type == 'latency_above':
                subject = f"⚠️ Rendimiento Degradado: {alert.service_name}"
            elif alert.alert_type == 'consecutive_failures':
                subject = f"🚨 Interrupción Persistente: {alert.service_name}"
            else:
                subject = f"🔴 Incidencia de Conexión: {alert.service_name}"

            # Render HTML content
            html_content = render_to_string('emails/alert_email.html', {'alert': alert})
            
            send_mail(
                subject=subject,
                message=alert.message,  # Fallback plain text
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipients,
                html_message=html_content,
                fail_silently=False,
            )
            logger.info("Alert HTML email sent to %s with subject: %s", recipients, subject)
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
