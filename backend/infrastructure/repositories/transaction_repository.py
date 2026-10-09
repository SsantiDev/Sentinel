from typing import Dict, List, Optional, Tuple

from django.conf import settings

from domain.entities.transaction import (
    DetectionConfig, Transaction, TransactionAnomaly,
)
from domain.interfaces.transaction_repository import ITransactionRepository
from infrastructure.models import (
    DetectionConfigModel, TransactionModel, TransactionAnomalyModel,
)
from infrastructure.repositories.transaction_metrics import TransactionMetricsQueries


class DjangoTransactionRepository(ITransactionRepository):
    """Acceso a datos de transacciones y anomalias usando el ORM de Django.

    Implementa la interfaz del dominio (ITransactionRepository): los casos de
    uso hablan con esta clase sin saber que por debajo hay una base de datos.
    Traduce entre modelos de Django (tablas) y entidades del dominio.
    """

    def __init__(self):
        # Las consultas de agregacion del tablero viven en un modulo aparte
        # (una sola responsabilidad); el repositorio solo delega en ellas.
        self._metrics = TransactionMetricsQueries()

    # --- Configuracion de deteccion (una sola fila, pk=1) ---

    def get_config(self) -> DetectionConfig:
        """Devuelve la config de deteccion; la crea si no existe.

        Al crearla por primera vez, 'require_signature' se siembra con el valor
        del entorno (TRANSACTIONS_REQUIRE_SIGNATURE). A partir de ahi, el valor
        vive en la base y lo controla el super administrador desde el panel.
        """
        m, _ = DetectionConfigModel.objects.get_or_create(
            pk=1,
            defaults={'require_signature': settings.TRANSACTIONS_REQUIRE_SIGNATURE},
        )
        return self._to_config_entity(m)

    def save_config(self, config: DetectionConfig) -> DetectionConfig:
        """Guarda (crea o actualiza) la config de deteccion y devuelve la version guardada."""
        m, _ = DetectionConfigModel.objects.update_or_create(
            pk=1,
            defaults={
                'window_seconds': config.window_seconds,
                'morning_limit': config.morning_limit,
                'afternoon_limit': config.afternoon_limit,
                'night_limit': config.night_limit,
                'require_signature': config.require_signature,
            },
        )
        return self._to_config_entity(m)

    # --- Transacciones ---

    def id_txn_exists(self, id_txn: int) -> bool:
        """True si ya existe una transaccion con ese idTxn (para rechazar duplicados)."""
        return TransactionModel.objects.filter(id_txn=id_txn).exists()

    def save_transactions(self, transactions: List[Transaction]) -> List[Transaction]:
        """Inserta en bloque (bulk_create) las transacciones validas y las devuelve."""
        created = TransactionModel.objects.bulk_create([
            TransactionModel(
                id_txn=t.id_txn, user=t.user, date=t.date, value=t.value,
                payment_method=t.payment_method, hash=t.hash,
            )
            for t in transactions
        ])
        return [self._to_txn_entity(m) for m in created]

    def mark_transactions_anomalous(self, id_txns: List[int]) -> None:
        """Marca como anomalas (is_anomalous=True) las transacciones de la lista."""
        TransactionModel.objects.filter(id_txn__in=id_txns).update(is_anomalous=True)

    def get_user_transactions_in_range(self, user, start, end) -> List[Transaction]:
        """Transacciones de un usuario entre dos fechas, ordenadas (para la ventana)."""
        rows = TransactionModel.objects.filter(
            user=user, date__gte=start, date__lte=end,
        ).order_by('date')
        return [self._to_txn_entity(m) for m in rows]

    # --- Anomalias ---

    def exists_overlapping_anomaly(self, user, window_start, window_end) -> bool:
        """True si una anomalia previa del usuario se solapa con esta ventana.

        Evita reportar dos veces la misma rafaga cuando llega en peticiones
        sucesivas. Hay solape si [window_start, window_end] se cruza con el
        rango de una anomalia ya guardada.
        """
        return TransactionAnomalyModel.objects.filter(
            user=user,
            window_start__lte=window_end,
            window_end__gte=window_start,
        ).exists()

    def save_anomaly(self, anomaly: TransactionAnomaly) -> TransactionAnomaly:
        """Guarda una anomalia detectada y devuelve la version persistida."""
        m = TransactionAnomalyModel.objects.create(
            user=anomaly.user,
            transaction_count=anomaly.transaction_count,
            window_seconds=anomaly.window_seconds,
            threshold=anomaly.threshold,
            time_band=anomaly.time_band,
            level=anomaly.level,
            total_value=anomaly.total_value,
            window_start=anomaly.window_start,
            window_end=anomaly.window_end,
        )
        return self._to_anomaly_entity(m)

    def reset_all(self) -> Tuple[int, int]:
        """Borra TODAS las transacciones y anomalias; devuelve (transacciones, anomalias).

        Deja el entorno de evaluacion en blanco. Se borran tambien las anomalias
        porque el detector tiene anti-duplicado por ventana: si quedaran, una
        rafaga re-enviada no se volveria a marcar.
        """
        anomalies, _ = TransactionAnomalyModel.objects.all().delete()
        transactions, _ = TransactionModel.objects.all().delete()
        return transactions, anomalies

    # --- Metricas del dashboard ---

    def get_stats_counts(self) -> Dict:
        """Conteos crudos del tablero. Delega en las consultas de agregacion."""
        return self._metrics.get_stats_counts()

    def get_hourly_anomaly_distribution(self) -> List[Tuple[int, int]]:
        """Anomalias por hora del dia (0-23). Delega en las consultas de agregacion."""
        return self._metrics.get_hourly_anomaly_distribution()

    def get_daily_evolution(self, days: int) -> List[Tuple[str, int, int]]:
        """Evolucion diaria de los ultimos 'days' dias. Delega en las consultas."""
        return self._metrics.get_daily_evolution(days)

    def get_anomaly_by_id(self, anomaly_id: int) -> Optional[TransactionAnomaly]:
        """Devuelve la anomalia por su id, o None si no existe."""
        try:
            m = TransactionAnomalyModel.objects.get(pk=anomaly_id)
        except TransactionAnomalyModel.DoesNotExist:
            return None
        return self._to_anomaly_entity(m)

    def get_transactions_in_window(self, anomaly: TransactionAnomaly) -> List[Transaction]:
        """Transacciones del usuario dentro de la ventana de la anomalia (su linea de tiempo)."""
        rows = TransactionModel.objects.filter(
            user=anomaly.user,
            date__gte=anomaly.window_start,
            date__lte=anomaly.window_end,
        ).order_by('date')
        return [self._to_txn_entity(m) for m in rows]

    def update_anomaly_status(self, anomaly_id: int, status: str) -> Optional[TransactionAnomaly]:
        """Cambia el estado de revision de una anomalia (open/reviewed/discarded)."""
        try:
            m = TransactionAnomalyModel.objects.get(pk=anomaly_id)
        except TransactionAnomalyModel.DoesNotExist:
            return None
        m.status = status
        m.save(update_fields=['status'])
        return self._to_anomaly_entity(m)

    # --- Traductores modelo (tabla) -> entidad del dominio ---

    def _to_config_entity(self, m: DetectionConfigModel) -> DetectionConfig:
        return DetectionConfig(
            id=m.pk,
            window_seconds=m.window_seconds,
            morning_limit=m.morning_limit,
            afternoon_limit=m.afternoon_limit,
            night_limit=m.night_limit,
            require_signature=m.require_signature,
        )

    def _to_txn_entity(self, m: TransactionModel) -> Transaction:
        return Transaction(
            id=m.pk,
            id_txn=m.id_txn,
            user=m.user,
            date=m.date,
            value=m.value,
            payment_method=m.payment_method,
            hash=m.hash,
            is_anomalous=m.is_anomalous,
        )

    def _to_anomaly_entity(self, m: TransactionAnomalyModel) -> TransactionAnomaly:
        return TransactionAnomaly(
            id=m.pk,
            user=m.user,
            transaction_count=m.transaction_count,
            window_seconds=m.window_seconds,
            threshold=m.threshold,
            time_band=m.time_band,
            level=m.level,
            total_value=m.total_value,
            window_start=m.window_start,
            window_end=m.window_end,
            status=m.status,
            detected_at=m.detected_at,
        )
