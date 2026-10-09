from datetime import timedelta
from decimal import Decimal
from typing import Dict, List, Tuple

from django.db.models import Count, Sum
from django.db.models.functions import ExtractHour, TruncDate
from django.utils import timezone

from infrastructure.models import TransactionModel, TransactionAnomalyModel

# Cuantos elementos se traen para los rankings del tablero (usuarios y casos
# mas recurrentes). La UI muestra los primeros 5 y abre el resto en un modal
# "ver mas"; por eso se traen mas de 5.
TOP_RANKING_SIZE = 20


class TransactionMetricsQueries:
    """Consultas de agregacion (solo lectura) que alimentan el tablero.

    Se separan del repositorio de escritura/CRUD porque tienen una sola razon
    para cambiar: como se resumen los datos para el panel. El repositorio las
    expone delegando aqui, de modo que los casos de uso siguen hablando con una
    unica interfaz de dominio.
    """

    def get_stats_counts(self) -> Dict:
        """Calcula los conteos crudos que alimentan el tablero de anomalias.

        Devuelve un diccionario con, por cada metrica, su valor ya consultado a
        la base. Los porcentajes/promedios NO se calculan aqui (eso lo hace el
        caso de uso calculate_transaction_stats); aqui solo se cuentan cosas.
        """
        # Cortes de tiempo para las ventanas "hoy / semana / mes".
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=7)
        month_start = now - timedelta(days=30)

        txns = TransactionModel.objects
        anomalies = TransactionAnomalyModel.objects

        # Conteo de anomalias agrupadas por estado (open/reviewed/discarded)
        # y por nivel de gravedad (low/medium/high), como diccionarios.
        status_counts = dict(anomalies.values_list('status').annotate(c=Count('id')))
        level_counts = dict(anomalies.values_list('level').annotate(c=Count('id')))

        # Suma del valor (monto) de todas las transacciones marcadas como anomalas.
        # Si no hay ninguna, Sum devuelve None, por eso el 'or Decimal(0)'.
        suspicious_value = (
            txns.filter(is_anomalous=True).aggregate(s=Sum('value'))['s'] or Decimal('0')
        )

        # Total de transacciones agrupadas en anomalias: cada anomalia es una
        # rafaga de N transacciones (transaction_count). Sumarlas responde
        # "cuantas transacciones estan involucradas en casos de multiples
        # transacciones". Sum devuelve None si no hay anomalias -> 0.
        anomalies_transaction_total = (
            anomalies.aggregate(s=Sum('transaction_count'))['s'] or 0
        )

        return {
            # Volumen de transacciones por ventana de tiempo.
            'transactions_today': txns.filter(date__gte=today_start).count(),
            'transactions_this_week': txns.filter(date__gte=week_start).count(),
            'transactions_this_month': txns.filter(date__gte=month_start).count(),
            # Anomalias detectadas por ventana de tiempo.
            'anomalies_today': anomalies.filter(detected_at__gte=today_start).count(),
            'anomalies_this_week': anomalies.filter(detected_at__gte=week_start).count(),
            'anomalies_this_month': anomalies.filter(detected_at__gte=month_start).count(),
            # Totales historicos.
            'total_transactions': txns.count(),
            'total_anomalies': anomalies.count(),
            'distinct_users': txns.values('user').distinct().count(),       # usuarios unicos
            'affected_users_count': anomalies.values('user').distinct().count(),  # con anomalia
            'suspicious_total_value': float(suspicious_value),
            'anomalies_transaction_total': anomalies_transaction_total,
            # Anomalias por estado de revision.
            'anomalies_open': status_counts.get('open', 0),
            'anomalies_reviewed': status_counts.get('reviewed', 0),
            'anomalies_discarded': status_counts.get('discarded', 0),
            # Anomalias por nivel de gravedad.
            'anomalies_by_level': {
                'low': level_counts.get('low', 0),
                'medium': level_counts.get('medium', 0),
                'high': level_counts.get('high', 0),
            },
            'payment_method_distribution': self._payment_distribution(txns),
            'top_recurrent_users': self._top_recurrent_users(anomalies),
            'top_recurrent_cases': self._top_recurrent_cases(anomalies),
        }

    def _payment_distribution(self, txns) -> List[Dict]:
        """Cuantas transacciones hay por cada metodo de pago (de mayor a menor)."""
        return [
            {'method': row['payment_method'], 'count': row['c']}
            for row in txns.values('payment_method').annotate(c=Count('id')).order_by('-c')
        ]

    def _top_recurrent_users(self, anomalies) -> List[Dict]:
        """Los usuarios con mas anomalias (los mas reincidentes)."""
        return [
            {'user': row['user'], 'anomaly_count': row['c']}
            for row in (
                anomalies.values('user').annotate(c=Count('id'))
                .order_by('-c')[:TOP_RANKING_SIZE]
            )
        ]

    def _top_recurrent_cases(self, anomalies) -> List[Dict]:
        """Los tipos de caso mas frecuentes: combinacion de franja horaria y nivel.

        Agrupa las anomalias por (franja, nivel) para responder "que clase de
        anomalia se repite mas" (p. ej. rafagas de nivel alto en la madrugada).
        """
        return [
            {'time_band': row['time_band'], 'level': row['level'], 'count': row['c']}
            for row in (
                anomalies.values('time_band', 'level').annotate(c=Count('id'))
                .order_by('-c')[:TOP_RANKING_SIZE]
            )
        ]

    def get_hourly_anomaly_distribution(self) -> List[Tuple[int, int]]:
        """Cuantas anomalias hubo por hora del dia (0-23), para el grafico horario."""
        rows = (
            TransactionAnomalyModel.objects.annotate(hour=ExtractHour('window_end'))
            .values('hour').annotate(c=Count('id')).order_by('hour')
        )
        return [(row['hour'], row['c']) for row in rows]

    def get_daily_evolution(self, days: int) -> List[Tuple[str, int, int]]:
        """Evolucion diaria de los ultimos 'days' dias: (fecha, #transacciones, #anomalias)."""
        since = timezone.now() - timedelta(days=days)

        # Conteos por dia para transacciones y para anomalias (diccionarios dia->conteo).
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
        # Union ordenada de los dias que aparecen en cualquiera de los dos.
        all_days = sorted(set(txns_by_day) | set(anomalies_by_day))
        return [
            (day.isoformat(), txns_by_day.get(day, 0), anomalies_by_day.get(day, 0))
            for day in all_days
        ]
