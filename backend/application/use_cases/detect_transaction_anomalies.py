from collections import defaultdict
from decimal import Decimal
from typing import List

from domain.entities.transaction import (
    DetectionConfig, Transaction, TransactionAnomaly,
)
from application.use_cases.time_band import get_time_band, threshold_for_band


def _severity_level(count: int, threshold: int) -> str:
    """Clasifica que tan grave es una anomalia segun cuanto supera el limite.

    Parametros:
        count:     cuantas transacciones cayeron dentro de la ventana.
        threshold: limite permitido para esa franja horaria.

    Devuelve 'high' / 'medium' / 'low' comparando la razon count/threshold:
        - >= 2.0  -> 'high'   (el doble o mas del limite)
        - >= 1.5  -> 'medium'
        - resto   -> 'low'
    """
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
    """Detecta rafagas de UN usuario agrupando en ventanas NO solapadas.

    Parametros:
        transactions: transacciones del usuario YA ordenadas por fecha.
        config:        limites por franja y tamano de ventana (en segundos).

    Tecnica (ventanas no solapadas):
        Desde la primera transaccion sin consumir se abre una ventana de 'window'
        segundos y se cuentan todas las que caen dentro (desde esa primera hasta
        la ultima que este a <= 'window' segundos de ella). Si esa cantidad
        alcanza el limite de la franja horaria, el grupo es UNA anomalia y se
        continua DESPUES de su ultima transaccion (sin reportar dos veces las
        mismas). Si no alcanza el limite, se avanza una transaccion y se reintenta.

        Asi una rafaga larga se reparte en varias anomalias (una por ventana) en
        vez de colapsar en una sola, y el nivel de cada anomalia sale de cuantas
        transacciones cayeron en su ventana frente al limite (mas concentracion
        en la ventana = mas grave).

    Devuelve la lista de anomalias encontradas para ese usuario.
    """
    anomalies: List[TransactionAnomaly] = []
    window = config.window_seconds
    n = len(transactions)
    start_idx = 0

    while start_idx < n:
        start = transactions[start_idx].date
        # Ultima transaccion dentro de 'window' segundos desde la primera.
        end_idx = start_idx
        while end_idx + 1 < n and (
            transactions[end_idx + 1].date - start
        ).total_seconds() <= window:
            end_idx += 1

        count = end_idx - start_idx + 1
        # El limite depende de la franja horaria (manana/tarde/noche) del inicio
        # de la ventana.
        band = get_time_band(start)
        threshold = threshold_for_band(band, config)

        if count >= threshold:
            group = transactions[start_idx:end_idx + 1]
            total_value = sum((t.value for t in group), Decimal('0'))
            anomalies.append(TransactionAnomaly(
                user=group[0].user,
                transaction_count=count,
                window_seconds=window,
                threshold=threshold,
                time_band=band,
                level=_severity_level(count, threshold),
                total_value=total_value,
                window_start=group[0].date,
                window_end=group[-1].date,
                transaction_ids=[t.id_txn for t in group],
            ))
            # Ventanas no solapadas: continua despues de este grupo.
            start_idx = end_idx + 1
        else:
            start_idx += 1

    return anomalies


def detect_transaction_anomalies(
    transactions: List[Transaction],
    config: DetectionConfig,
) -> List[TransactionAnomaly]:
    """Punto de entrada: detecta anomalias de concentracion por usuario.

    Parametros:
        transactions: lista de transacciones (de uno o varios usuarios, en
                      cualquier orden).
        config:        configuracion de deteccion (ventana y limites por franja).

    Pasos:
        1. Agrupa por usuario: cada usuario tiene su propia ventana independiente
           (la rafaga de uno no se mezcla con la de otro).
        2. Ordena cronologicamente las de cada usuario.
        3. Corre la ventana deslizante por usuario (_detect_for_user).

    Devuelve todas las anomalias encontradas (de todos los usuarios).
    """
    by_user = defaultdict(list)
    for txn in transactions:
        by_user[txn.user].append(txn)

    result: List[TransactionAnomaly] = []
    for user_txns in by_user.values():
        user_txns.sort(key=lambda t: t.date)
        result.extend(_detect_for_user(user_txns, config))
    return result
