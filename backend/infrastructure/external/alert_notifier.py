import logging
import requests
from django.core.mail import send_mail
from django.conf import settings
from django.db.models import F
from domain.entities.service import Alert
from domain.interfaces.alert_notifier import IAlertNotifier

logger = logging.getLogger(__name__)

TRIAL_EMAIL_LIMIT = 30


class LogAlertNotifier(IAlertNotifier):
    def send(self, alert: Alert) -> None:
        logger.warning("ALERT service_id=%s: %s", alert.service_id, alert.message)


from django.template.loader import render_to_string
from infrastructure.config_manager import ConfigManager


class EmailAlertNotifier(IAlertNotifier):
    def send(self, alert: Alert) -> None:
        # Check trial email limit for non-privileged service owners
        try:
            from infrastructure.models import ServiceModel, UserProfileModel
            service = ServiceModel.objects.select_related('owner').filter(id=alert.service_id).first()
            if service and service.owner and not (service.owner.is_staff or service.owner.is_superuser):
                profile, _ = UserProfileModel.objects.get_or_create(user=service.owner)
                if profile.emails_sent >= TRIAL_EMAIL_LIMIT:
                    logger.warning(
                        "Alert email blocked for user %s — trial limit of %d reached",
                        service.owner.username, TRIAL_EMAIL_LIMIT,
                    )
                    return
                UserProfileModel.objects.filter(pk=profile.pk).update(emails_sent=F('emails_sent') + 1)
        except Exception as exc:
            logger.warning("Could not check email limit: %s", exc)

        # Priority: alert.recipient -> owner's personal email -> global_email -> settings fallback
        recipients = []
        if alert.recipient and alert.recipient.strip():
            recipients = [alert.recipient]
        else:
            if service and service.owner:
                user_prefs = ConfigManager.get_user_config(service.owner.username)
                personal_email = user_prefs.get('notification_email', '').strip()
                if personal_email:
                    recipients = [personal_email]
            if not recipients:
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
            if alert.alert_type == 'latency_above':
                subject = f"⚠️ Rendimiento Degradado: {alert.service_name}"
            elif alert.alert_type == 'consecutive_failures':
                subject = f"🚨 Interrupción Persistente: {alert.service_name}"
            else:
                subject = f"🔴 Incidencia de Conexión: {alert.service_name}"

            html_content = render_to_string('emails/alert_email.html', {'alert': alert})

            send_mail(
                subject=subject,
                message=alert.message,
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
