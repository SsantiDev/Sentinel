from rest_framework import serializers

from infrastructure.models import PlanModel, UsageAnomalyModel


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanModel
        fields = ['id', 'name', 'max_checks_per_window', 'window_seconds', 'is_active']


class UsageAnomalySerializer(serializers.ModelSerializer):
    user = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = UsageAnomalyModel
        fields = ['id', 'user', 'event_count', 'window_seconds', 'threshold', 'status', 'detected_at']
        read_only_fields = ['id', 'user', 'event_count', 'window_seconds', 'threshold', 'detected_at']
