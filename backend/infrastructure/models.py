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
    contact = models.CharField(max_length=255, help_text='Email address', blank=True)
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
        indexes = [
            models.Index(fields=['service', '-checked_at'], name='check_results_svc_at_idx'),
        ]


class ServiceDependencyModel(models.Model):
    """Una fila = una flecha del grafo: 'service' depende de 'depends_on'.
    'unique_together' evita guardar la misma flecha dos veces.
    """
    service = models.ForeignKey(ServiceModel, on_delete=models.CASCADE, related_name='dependencies')
    depends_on = models.ForeignKey(ServiceModel, on_delete=models.CASCADE, related_name='dependents')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'service_dependencies'
        unique_together = ('service', 'depends_on')

    def __str__(self):
        return f'{self.service.name} depende de {self.depends_on.name}'


class SchedulerRunModel(models.Model):
    """Tabla de una sola fila: guarda el estado de la ultima corrida del
    turnero (no historial, se pisa cada vez)."""
    last_run_at = models.DateTimeField()
    queued_count = models.IntegerField(default=0)  # cuantos servicios se encolaron esta corrida
    total_scheduled = models.IntegerField(default=0)  # cuantos servicios activos habia en total

    class Meta:
        db_table = 'scheduler_runs'


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


class PlanModel(models.Model):
    name = models.CharField(max_length=50, unique=True)
    max_checks_per_window = models.IntegerField()
    window_seconds = models.IntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'plans'

    def __str__(self):
        return self.name


class SubscriptionModel(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('cancelled', 'Cancelled'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscription',
    )
    plan = models.ForeignKey(PlanModel, on_delete=models.PROTECT, related_name='subscriptions')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'subscriptions'

    def __str__(self):
        return f'{self.user.username} — {self.plan.name}'


class UsageEventModel(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='usage_events',
    )
    event_type = models.CharField(max_length=50)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'usage_events'
        ordering = ['-occurred_at']
        indexes = [
            models.Index(fields=['user', '-occurred_at'], name='usage_events_user_at_idx'),
        ]


class UsageAnomalyModel(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('reviewed', 'Reviewed'),
        ('discarded', 'Discarded'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='usage_anomalies',
    )
    event_count = models.IntegerField()
    window_seconds = models.IntegerField()
    threshold = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    detected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'usage_anomalies'
        ordering = ['-detected_at']

    def __str__(self):
        return f'{self.user.username} — {self.event_count} en {self.window_seconds}s'


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_default_subscription(sender, instance, created, **kwargs):
    if created:
        free_plan = PlanModel.objects.filter(name='free').first()
        if free_plan:
            SubscriptionModel.objects.get_or_create(user=instance, defaults={'plan': free_plan})
