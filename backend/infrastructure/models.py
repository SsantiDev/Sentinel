from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfileModel(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sentinel_profile',
    )
    emails_sent = models.IntegerField(default=0)

    class Meta:
        db_table = 'user_profiles'

    def __str__(self):
        return f"{self.user.username} profile"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_sentinel_profile(sender, instance, created, **kwargs):
    if created:
        UserProfileModel.objects.get_or_create(user=instance)


class AlertRuleModel(models.Model):
    CONDITION_CHOICES = [
        ('consecutive_failures', 'Consecutive Failures'),
        ('latency_above', 'Latency Above'),
    ]
    CHANNEL_CHOICES = [('email', 'Email')]

    service = models.ForeignKey('ServiceModel', on_delete=models.CASCADE, related_name='alert_rules')
    condition = models.CharField(max_length=30, choices=CONDITION_CHOICES)
    threshold = models.FloatField(help_text='Failures count or ms value')
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='email')
    contact = models.CharField(max_length=255, help_text='Email address')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'alert_rules'

    def __str__(self):
        return f'{self.service.name} — {self.condition} > {self.threshold}'


class ServiceModel(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='services',
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    url = models.URLField()
    check_interval_seconds = models.IntegerField(default=60)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'services'

    def __str__(self):
        return self.name


class CheckResultModel(models.Model):
    STATUS_CHOICES = [('up', 'Up'), ('down', 'Down'), ('unknown', 'Unknown')]

    service = models.ForeignKey(ServiceModel, on_delete=models.CASCADE, related_name='checks')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    response_time_ms = models.FloatField(null=True, blank=True)
    status_code = models.IntegerField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    checked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'check_results'
        ordering = ['-checked_at']


class BlockedIPModel(models.Model):
    ip_address = models.GenericIPAddressField(unique=True)
    attempts = models.IntegerField(default=0)
    is_blocked = models.BooleanField(default=False)
    blocked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'blocked_ips'

    def __str__(self):
        return f"{self.ip_address} ({'BLOCKED' if self.is_blocked else 'Active'})"
