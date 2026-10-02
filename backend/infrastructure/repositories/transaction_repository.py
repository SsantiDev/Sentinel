from datetime import timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from django.db.models import Count, Sum
from django.db.models.functions import ExtractHour, TruncDate
from django.utils import timezone

from domain.entities.transaction import (
    DetectionConfig, Transaction, TransactionAnomaly,
)
from domain.interfaces.transaction_repository import ITransactionRepository
from infrastructure.models import (
    DetectionConfigModel, TransactionModel, TransactionAnomalyModel,
)


class DjangoTransactionRepository(ITransactionRepository):
    def get_config(self) -> DetectionConfig:
        m, _ = DetectionConfigModel.objects.get_or_create(pk=1)
        return self._to_config_entity(m)

    def save_config(self, config: DetectionConfig) -> DetectionConfig:
        m, _ = DetectionConfigModel.objects.update_or_create(
            pk=1,
            defaults={
                'window_seconds': config.window_seconds,
                'morning_limit': config.morning_limit,
                'afternoon_limit': config.afternoon_limit,
                'night_limit': config.night_limit,
            },
        )
        return self._to_config_entity(m)

    def id_txn_exists(self, id_txn: int) -> bool:
        return TransactionModel.objects.filter(id_txn=id_txn).exists()

    def save_transactions(self, transactions: List[Transaction]) -> List[Transaction]:
        created = TransactionModel.objects.bulk_create([
            TransactionModel(
                id_txn=t.id_txn, user=t.user, date=t.date, value=t.value,
                payment_method=t.payment_method, hash=t.hash,
            )
            for t in transactions
        ])
        return [self._to_txn_entity(m) for m in created]

    def mark_transactions_anomalous(self, id_txns: List[int]) -> None:
        TransactionModel.objects.filter(id_txn__in=id_txns).update(is_anomalous=True)

    def save_anomaly(self, anomaly: TransactionAnomaly) -> TransactionAnomaly:
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

    def get_stats_counts(self) -> Dict:
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=7)
        month_start = now - timedelta(days=30)

        txns = TransactionModel.objects
        anomalies = TransactionAnomalyModel.objects

        status_counts = dict(anomalies.values_list('status').annotate(c=Count('id')))
        level_counts = dict(anomalies.values_list('level').annotate(c=Count('id')))

        suspicious_value = (
            txns.filter(is_anomalous=True).aggregate(s=Sum('value'))['s'] or Decimal('0')
        )

        payment_distribution = [
            {'method': row['payment_method'], 'count': row['c']}
            for row in (
                txns.values('payment_method').annotate(c=Count('id')).order_by('-c')
            )
        ]
        top_recurrent_users = [
            {'user': row['user'], 'anomaly_count': row['c']}
            for row in (
                anomalies.values('user').annotate(c=Count('id')).order_by('-c')[:5]
            )
        ]

        return {
            'transactions_today': txns.filter(date__gte=today_start).count(),
            'transactions_this_week': txns.filter(date__gte=week_start).count(),
            'transactions_this_month': txns.filter(date__gte=month_start).count(),
            'anomalies_today': anomalies.filter(detected_at__gte=today_start).count(),
            'anomalies_this_week': anomalies.filter(detected_at__gte=week_start).count(),
            'anomalies_this_month': anomalies.filter(detected_at__gte=month_start).count(),
            'total_transactions': txns.count(),
            'total_anomalies': anomalies.count(),
            'distinct_users': txns.values('user').distinct().count(),
            'affected_users_count': anomalies.values('user').distinct().count(),
            'suspicious_total_value': float(suspicious_value),
            'anomalies_open': status_counts.get('open', 0),
            'anomalies_reviewed': status_counts.get('reviewed', 0),
            'anomalies_discarded': status_counts.get('discarded', 0),
            'anomalies_by_level': {
                'low': level_counts.get('low', 0),
                'medium': level_counts.get('medium', 0),
                'high': level_counts.get('high', 0),
            },
            'payment_method_distribution': payment_distribution,
            'top_recurrent_users': top_recurrent_users,
        }

    def get_hourly_anomaly_distribution(self) -> List[Tuple[int, int]]:
        rows = (
            TransactionAnomalyModel.objects.annotate(hour=ExtractHour('window_end'))
            .values('hour').annotate(c=Count('id')).order_by('hour')
        )
        return [(row['hour'], row['c']) for row in rows]

    def get_daily_evolution(self, days: int) -> List[Tuple[str, int, int]]:
        since = timezone.now() - timedelta(days=days)

        txns_by_day = dict(
            TransactionModel.objects.filter(date__gte=since)
            .annotate(day=TruncDate('date')).values('day')
            .annotate(c=Count('id')).values_list('day', 'c')
        )
        anomalies_by_day = dict(
            TransactionAnomalyModel.objects.filter(window_end__gte=since)
            .annotate(day=TruncDate('window_end')).values('day')
            .annotate(c=Count('id')).values_list('day', 'c')
        )
        all_days = sorted(set(txns_by_day) | set(anomalies_by_day))
        return [
            (day.isoformat(), txns_by_day.get(day, 0), anomalies_by_day.get(day, 0))
            for day in all_days
        ]

    def get_anomaly_by_id(self, anomaly_id: int) -> Optional[TransactionAnomaly]:
        try:
            m = TransactionAnomalyModel.objects.get(pk=anomaly_id)
        except TransactionAnomalyModel.DoesNotExist:
            return None
        return self._to_anomaly_entity(m)

    def get_transactions_in_window(self, anomaly: TransactionAnomaly) -> List[Transaction]:
        rows = TransactionModel.objects.filter(
            user=anomaly.user,
            date__gte=anomaly.window_start,
            date__lte=anomaly.window_end,
        ).order_by('date')
        return [self._to_txn_entity(m) for m in rows]

    def update_anomaly_status(self, anomaly_id: int, status: str) -> Optional[TransactionAnomaly]:
        try:
            m = TransactionAnomalyModel.objects.get(pk=anomaly_id)
        except TransactionAnomalyModel.DoesNotExist:
            return None
        m.status = status
        m.save(update_fields=['status'])
        return self._to_anomaly_entity(m)

    def _to_config_entity(self, m: DetectionConfigModel) -> DetectionConfig:
        return DetectionConfig(
            id=m.pk,
            window_seconds=m.window_seconds,
            morning_limit=m.morning_limit,
            afternoon_limit=m.afternoon_limit,
            night_limit=m.night_limit,
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
