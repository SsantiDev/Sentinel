from rest_framework import serializers
from infrastructure.models import ServiceModel, CheckResultModel, AlertRuleModel, ServiceDependencyModel


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


class ServiceDependencySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceDependencyModel
        fields = ['id', 'service', 'depends_on', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        # Reglas antes de guardar una dependencia nueva: no puede depender de
        # si mismo, y ambos servicios tienen que ser del usuario que pide.
        service = attrs['service']
        depends_on = attrs['depends_on']
        if service.id == depends_on.id:
            raise serializers.ValidationError({
                'error': 'Un servicio no puede depender de si mismo',
                'code': 'invalid_dependency',
            })
        owner = self.context['request'].user
        if service.owner_id != owner.id or depends_on.owner_id != owner.id:
            raise serializers.ValidationError({
                'error': 'Ambos servicios deben pertenecer al usuario actual',
                'code': 'invalid_dependency',
            })
        return attrs


class AlertRuleSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source='service.name', read_only=True)

    class Meta:
        model = AlertRuleModel
        fields = ['id', 'service', 'service_name', 'condition', 'threshold', 'channel', 'contact', 'is_active', 'created_at']
        read_only_fields = ['id', 'service_name', 'created_at']
