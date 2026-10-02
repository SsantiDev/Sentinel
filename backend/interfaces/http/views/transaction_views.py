from datetime import datetime

from django.conf import settings
from django.utils import timezone
from rest_framework import mixins, viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.response import Response

from infrastructure.models import TransactionAnomalyModel
from infrastructure.repositories.transaction_repository import DjangoTransactionRepository
from interfaces.http.serializers.transaction_serializer import (
    TransactionAnomalySerializer, DetectionConfigSerializer,
    TransactionSimulateSerializer,
)
from application.use_cases.ingest_transactions import ingest_transactions
from application.use_cases.simulate_transactions import build_signed_transactions
from application.use_cases.calculate_transaction_stats import calculate_transaction_stats
from application.use_cases.calculate_transaction_trends import calculate_transaction_trends
from domain.entities.transaction import DetectionConfig


class IsSuperUser(permissions.BasePermission):
    """Solo super administradores (is_superuser)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_superuser)


def _ingest_response(result):
    """Arma la respuesta HTTP de una ingesta y elige el codigo correcto.

    Parametro:
        result: IngestResult del caso de uso, con las listas 'accepted' y
                'rejected' y el contador 'anomalies_detected'.

    Codigo de respuesta:
        - 201 Created: se acepto al menos una transaccion.
        - 422 Unprocessable Entity: el cuerpo era valido pero NO entro ninguna
          (todas rechazadas por firma invalida, duplicado o formato). Asi el
          emisor sabe por el codigo que su envio no fue aceptado, sin tener que
          leer el detalle del cuerpo.
    """
    code = status.HTTP_201_CREATED if result.accepted else status.HTTP_422_UNPROCESSABLE_ENTITY
    return Response(
        {
            "accepted": len(result.accepted),       # cuantas se guardaron
            "rejected": result.rejected,            # las descartadas y su motivo
            "anomalies_detected": result.anomalies_detected,
        },
        status=code,
    )


class TransactionIngestView(APIView):
    """POST publico de ingesta. Acepta una transaccion o una lista.

    Es intencionalmente abierto (sin autenticacion) para que una evaluacion
    automatizada pueda enviar un flujo continuo de transacciones. La proteccion
    se apoya en tres capas:
      1. firma HMAC por transaccion (sin la clave no se puede falsificar),
      2. limite de peticiones por IP (ScopedRateThrottle) contra inundacion,
      3. tope de tamano de lote (evita payloads que agoten memoria).
    """
    permission_classes = [permissions.AllowAny]
    # Limite de peticiones por IP; la tasa vive en settings
    # (DEFAULT_THROTTLE_RATES['transactions_ingest']).
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'transactions_ingest'

    def post(self, request):
        # request.data puede ser un objeto (una transaccion) o una lista (lote).
        # Se normaliza siempre a lista para procesar igual ambos casos.
        data = request.data
        payloads = data if isinstance(data, list) else [data]

        # Cuerpo invalido: ni objeto ni lista de objetos -> 400.
        if not payloads or not all(isinstance(p, dict) for p in payloads):
            return Response(
                {"error": "Body must be a transaction object or a list", "code": "INVALID_BODY"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Tope de lote: un payload gigante podria agotar memoria -> 413.
        max_batch = settings.REST_FRAMEWORK.get('MAX_TRANSACTIONS_PER_REQUEST', 1000)
        if len(payloads) > max_batch:
            return Response(
                {"error": f"Batch too large (max {max_batch})", "code": "BATCH_TOO_LARGE"},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        # El caso de uso valida la firma, descarta duplicados, guarda las
        # validas y corre la ventana deslizante. Se le inyecta la clave secreta.
        repo = DjangoTransactionRepository()
        result = ingest_transactions(payloads, repo, settings.TRANSACTIONS_HMAC_SECRET)
        return _ingest_response(result)


class TransactionSimulateView(APIView):
    """Simulador del front: genera y FIRMA las transacciones en el servidor.

    Requiere usuario autenticado. El navegador no conoce la clave secreta; la
    confianza aqui viene de la sesion del usuario, no de la firma. Asi el
    simulador sigue funcionando sin exponer la clave en el cliente publico.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Valida los parametros del simulador (usuario, monto, metodo, fecha
        # base, cantidad y segundos entre transacciones).
        serializer = TransactionSimulateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # El servidor arma y firma el lote (el front solo manda parametros).
        # base_id en milisegundos da ids unicos por llamada.
        base_date = datetime.fromisoformat(data['date'])
        base_id = int(timezone.now().timestamp() * 1000)
        payloads = build_signed_transactions(
            settings.TRANSACTIONS_HMAC_SECRET,
            user=data['user'],
            value=data['value'],
            payment_method=data['paymentMethod'],
            base_date=base_date,
            count=data['count'],
            interval_seconds=data['intervalSeconds'],
            base_id=base_id,
        )

        # Se ingesta por el mismo camino que el endpoint publico (misma validacion
        # y misma deteccion de anomalias).
        repo = DjangoTransactionRepository()
        result = ingest_transactions(payloads, repo, settings.TRANSACTIONS_HMAC_SECRET)
        return _ingest_response(result)


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
