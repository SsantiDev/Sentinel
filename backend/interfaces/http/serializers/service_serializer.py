from rest_framework import serializers
from infrastructure.models import ServiceModel, CheckResultModel, AlertRuleModel


class ServiceSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    response_time_ms = serializers.SerializerMethodField()
    last_checked_at = serializers.SerializerMethodField()
    recent_history = serializers.SerializerMethodField()

    class Meta:
        model = ServiceModel
        fields = ['id', 'name', 'url', 'check_interval_seconds', 'is_active', 'created_at', 'status', 'response_time_ms', 'last_checked_at', 'recent_history']
        read_only_fields = ['id', 'created_at', 'status', 'response_time_ms', 'last_checked_at', 'recent_history']

    def _last_check(self, obj):
        return obj.checks.first()

    def get_recent_history(self, obj):
        checks = obj.checks.all()[:30]
        return CheckResultSerializer(checks, many=True).data

    def get_status(self, obj):
        check = self._last_check(obj)
        return check.status if check else 'unknown'

    def get_response_time_ms(self, obj):
        check = self._last_check(obj)
        return check.response_time_ms if check else None

    def get_last_checked_at(self, obj):
        check = self._last_check(obj)
        return check.checked_at.isoformat() if check else None


class CheckResultSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source='service.name', read_only=True)

    class Meta:
        model = CheckResultModel
        fields = ['id', 'service', 'service_name', 'status', 'response_time_ms', 'status_code', 'error_message', 'checked_at']
        read_only_fields = fields


class AlertRuleSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source='service.name', read_only=True)

    class Meta:
        model = AlertRuleModel
        fields = ['id', 'service', 'service_name', 'condition', 'threshold', 'channel', 'contact', 'is_active', 'created_at']
        read_only_fields = ['id', 'service_name', 'created_at']
