from django.db import models


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
