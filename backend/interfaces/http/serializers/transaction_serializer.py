from datetime import datetime

from rest_framework import serializers

from infrastructure.models import DetectionConfigModel, TransactionAnomalyModel


class TransactionAnomalySerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionAnomalyModel
        fields = [
            'id', 'user', 'transaction_count', 'window_seconds', 'threshold',
            'time_band', 'level', 'total_value', 'window_start', 'window_end',
            'status', 'detected_at',
        ]
        read_only_fields = [
            'id', 'user', 'transaction_count', 'window_seconds', 'threshold',
            'time_band', 'level', 'total_value', 'window_start', 'window_end',
            'detected_at',
        ]


class DetectionConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetectionConfigModel
        fields = [
            'window_seconds', 'morning_limit', 'afternoon_limit',
            'night_limit', 'updated_at',
        ]
        read_only_fields = ['updated_at']

    def validate(self, attrs):
        for key in ('window_seconds', 'morning_limit', 'afternoon_limit', 'night_limit'):
            value = attrs.get(key)
            if value is not None and value < 1:
                raise serializers.ValidationError({key: 'Debe ser mayor o igual a 1.'})
        return attrs


class TransactionInputSerializer(serializers.Serializer):
    """Valida la estructura de una transaccion entrante (el hash se valida
    aparte en el caso de uso, contra los campos crudos)."""
    idTxn = serializers.IntegerField()
    user = serializers.EmailField()
    date = serializers.CharField()
    value = serializers.DecimalField(max_digits=18, decimal_places=2)
    paymentMethod = serializers.CharField()
    hash = serializers.CharField()


class TransactionSimulateSerializer(serializers.Serializer):
    """Parametros del simulador del front. El servidor genera y firma las
    transacciones (el navegador no conoce la clave secreta)."""
    user = serializers.EmailField()
    value = serializers.IntegerField(min_value=0)
    paymentMethod = serializers.CharField()
    date = serializers.CharField()
    count = serializers.IntegerField(min_value=1, max_value=1000)
    intervalSeconds = serializers.IntegerField(min_value=0, max_value=86400)

    def validate_date(self, value):
        try:
            datetime.fromisoformat(value)
        except ValueError:
            raise serializers.ValidationError('Fecha ISO 8601 invalida.')
        return value
