from django.conf import settings
from rest_framework import mixins, viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response

from infrastructure.models import TransactionAnomalyModel
from infrastructure.repositories.transaction_repository import DjangoTransactionRepository
from interfaces.http.serializers.transaction_serializer import (
    TransactionAnomalySerializer, DetectionConfigSerializer,
)
from application.use_cases.ingest_transactions import ingest_transactions
from application.use_cases.calculate_transaction_stats import calculate_transaction_stats
from application.use_cases.calculate_transaction_trends import calculate_transaction_trends
from domain.entities.transaction import DetectionConfig


class IsSuperUser(permissions.BasePermission):
    """Solo super administradores (is_superuser)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_superuser)


class TransactionIngestView(APIView):
    """POST publico de ingesta. Acepta una transaccion o una lista.

    Es intencionalmente abierto (sin autenticacion) para que una evaluacion
    automatizada pueda enviar un flujo continuo de transacciones (generacion
    de TXNS durante varios minutos). Por eso NO lleva throttling: la
    proteccion se basa en el hash de integridad por transaccion, el limite de
    tamano de lote y las cabeceras de seguridad.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = []

    def post(self, request):
        data = request.data
        payloads = data if isinstance(data, list) else [data]

        if not payloads or not all(isinstance(p, dict) for p in payloads):
            return Response(
                {"error": "Body must be a transaction object or a list", "code": "INVALID_BODY"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_batch = settings.REST_FRAMEWORK.get('MAX_TRANSACTIONS_PER_REQUEST', 1000)
        if len(payloads) > max_batch:
            return Response(
                {"error": f"Batch too large (max {max_batch})", "code": "BATCH_TOO_LARGE"},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        repo = DjangoTransactionRepository()
        result = ingest_transactions(payloads, repo)

        return Response(
            {
                "accepted": len(result.accepted),
                "rejected": result.rejected,
                "anomalies_detected": result.anomalies_detected,
            },
            status=status.HTTP_201_CREATED,
        )


class TransactionAnomalyViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = TransactionAnomalyModel.objects.all()
    serializer_class = TransactionAnomalySerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
    http_method_names = ['get', 'patch', 'head', 'options']

    @action(detail=False, methods=['get'])
    def stats(self, request):
        repo = DjangoTransactionRepository()
        counts = repo.get_stats_counts()
        return Response(calculate_transaction_stats(counts))

    @action(detail=False, methods=['get'])
    def trends(self, request):
        repo = DjangoTransactionRepository()
        hourly = repo.get_hourly_anomaly_distribution()
        daily = repo.get_daily_evolution(days=14)
        return Response(calculate_transaction_trends(hourly, daily))

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        repo = DjangoTransactionRepository()
        anomaly = repo.get_anomaly_by_id(pk)
        if not anomaly:
            return Response(
                {"error": "Anomaly not found", "code": "ANOMALY_NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND,
            )

        txns = repo.get_transactions_in_window(anomaly)
        return Response({
            "anomaly": TransactionAnomalySerializer(
                self.get_queryset().get(pk=anomaly.id)
            ).data,
            "window_seconds": anomaly.window_seconds,
            "transactions_in_window": [
                {
                    "id_txn": t.id_txn,
                    "date": t.date.isoformat(),
                    "value": float(t.value),
                    "payment_method": t.payment_method,
                }
                for t in txns
            ],
        })


class DetectionConfigView(APIView):
    """GET/PUT de la configuracion de deteccion (solo super administradores)."""
    permission_classes = [permissions.IsAuthenticated, IsSuperUser]

    def get(self, request):
        repo = DjangoTransactionRepository()
        config = repo.get_config()
        return Response(self._to_payload(config))

    def put(self, request):
        serializer = DetectionConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = DjangoTransactionRepository()
        current = repo.get_config()
        data = serializer.validated_data
        updated = repo.save_config(DetectionConfig(
            window_seconds=data.get('window_seconds', current.window_seconds),
            morning_limit=data.get('morning_limit', current.morning_limit),
            afternoon_limit=data.get('afternoon_limit', current.afternoon_limit),
            night_limit=data.get('night_limit', current.night_limit),
        ))
        return Response(self._to_payload(updated))

    def _to_payload(self, config: DetectionConfig):
        return {
            "window_seconds": config.window_seconds,
            "morning_limit": config.morning_limit,
            "afternoon_limit": config.afternoon_limit,
            "night_limit": config.night_limit,
        }
