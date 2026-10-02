from collections import defaultdict
from decimal import Decimal
from typing import List

from domain.entities.transaction import (
    DetectionConfig, Transaction, TransactionAnomaly,
)
from application.use_cases.time_band import get_time_band, threshold_for_band


def _severity_level(count: int, threshold: int) -> str:
    """Nivel de la anomalia segun cuanto supera el limite permitido."""
    ratio = count / threshold if threshold else 0
    if ratio >= 2:
        return 'high'
    if ratio >= 1.5:
        return 'medium'
    return 'low'


def _detect_for_user(
    transactions: List[Transaction],
    config: DetectionConfig,
) -> List[TransactionAnomaly]:
    """
    Recorre las transacciones (ya ordenadas) de un usuario con una ventana
    deslizante de dos punteros. Cuando la cantidad dentro de la ventana
    alcanza el limite de su franja horaria, registra una anomalia y avanza
    mas alla de esa rafaga para no reportarla por duplicado.
    """
    anomalies: List[TransactionAnomaly] = []
    window = config.window_seconds
    left = 0

    for right in range(len(transactions)):
        end = transactions[right].date
        # Encoge la ventana por la izquierda mientras exceda el rango.
        while (end - transactions[left].date).total_seconds() > window:
            left += 1

        count = right - left + 1
        band = get_time_band(end)
        threshold = threshold_for_band(band, config)

        if count >= threshold:
            window_txns = transactions[left:right + 1]
            total_value = sum((t.value for t in window_txns), Decimal('0'))
            anomalies.append(TransactionAnomaly(
                user=transactions[right].user,
                transaction_count=count,
                window_seconds=window,
                threshold=threshold,
                time_band=band,
                level=_severity_level(count, threshold),
                total_value=total_value,
                window_start=window_txns[0].date,
                window_end=end,
            ))
            # Avanza mas alla de la rafaga detectada.
            left = right + 1

    return anomalies


def detect_transaction_anomalies(
    transactions: List[Transaction],
    config: DetectionConfig,
) -> List[TransactionAnomaly]:
    """
    Agrupa por usuario (ventanas independientes), ordena cronologicamente y
    detecta anomalias de concentracion por franja horaria.
    """
    by_user = defaultdict(list)
    for txn in transactions:
        by_user[txn.user].append(txn)

    result: List[TransactionAnomaly] = []
    for user_txns in by_user.values():
        user_txns.sort(key=lambda t: t.date)
        result.extend(_detect_for_user(user_txns, config))
    return result
