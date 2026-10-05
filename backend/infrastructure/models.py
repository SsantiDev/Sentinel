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


class DetectionConfigModel(models.Model):
    """Configuracion editable (fila unica) de la deteccion por ventana
    deslizante: duracion de la ventana y limite por franja horaria."""
    window_seconds = models.IntegerField(default=3)
    morning_limit = models.IntegerField(default=10)
    afternoon_limit = models.IntegerField(default=6)
    night_limit = models.IntegerField(default=3)
    # Exigir firma HMAC en la ingesta publica. Controlable en vivo por un
    # super administrador desde el panel (sin reiniciar el servidor).
    require_signature = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'detection_config'

    def __str__(self):
        return f'ventana={self.window_seconds}s (m/t/n={self.morning_limit}/{self.afternoon_limit}/{self.night_limit})'


class TransactionModel(models.Model):
    PAYMENT_METHODS = [
        ('Tarjeta', 'Tarjeta'),
        ('Efectivo', 'Efectivo'),
        ('Transferencia', 'Transferencia'),
        ('PSE', 'PSE'),
        ('Otro', 'Otro'),
    ]

    id_txn = models.BigIntegerField(unique=True)
    user = models.EmailField()
    date = models.DateTimeField()
    value = models.DecimalField(max_digits=18, decimal_places=2)
    payment_method = models.CharField(max_length=30)
    hash = models.CharField(max_length=128)
    is_anomalous = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transactions'
        ordering = ['-date']
        indexes = [
            models.Index(fields=['user', 'date'], name='transactions_user_date_idx'),
        ]

    def __str__(self):
        return f'#{self.id_txn} {self.user} {self.value}'


class TransactionAnomalyModel(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('reviewed', 'Reviewed'),
        ('discarded', 'Discarded'),
    ]
    LEVEL_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    user = models.EmailField()
    transaction_count = models.IntegerField()
    window_seconds = models.IntegerField()
    threshold = models.IntegerField()
    time_band = models.CharField(max_length=20)
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='low')
    total_value = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    window_start = models.DateTimeField()
    window_end = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    detected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transaction_anomalies'
        ordering = ['-detected_at']
        indexes = [
            models.Index(fields=['user', 'window_start'], name='txn_anomaly_user_win_idx'),
        ]

    def __str__(self):
        return f'{self.user} — {self.transaction_count} en {self.window_seconds}s'
