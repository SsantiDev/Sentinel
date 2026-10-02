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
    """Detecta rafagas en las transacciones de UN usuario con ventana deslizante.

    Parametros:
        transactions: transacciones del usuario YA ordenadas por fecha.
        config:        limites por franja y tamano de ventana (en segundos).

    Tecnica (dos punteros 'left' y 'right'):
        'right' avanza una por una; 'left' marca el inicio de la ventana. Mientras
        la distancia en segundos entre la primera (left) y la actual (right) supere
        el tamano de ventana, se encoge moviendo 'left' a la derecha. Asi, en todo
        momento, [left..right] son las transacciones dentro de la ventana que
        termina en la transaccion actual.

        Cuando esa cantidad alcanza el limite de su franja horaria, estamos ante
        una rafaga. En vez de trocearla, se EXTIENDE el episodio mientras las
        transacciones sigan llegando dentro de 'window' segundos de la anterior
        (rafaga continua) y se reporta como UNA sola anomalia que cubre todo el
        episodio. Luego se continua despues del episodio. Resultado: una ráfaga
        sostenida = una anomalia, sin importar cuantas transacciones tenga.

    Devuelve la lista de anomalias encontradas para ese usuario.
    """
    anomalies: List[TransactionAnomaly] = []
    window = config.window_seconds
    n = len(transactions)
    left = 0
    right = 0

    while right < n:
        end = transactions[right].date
        # Encoge la ventana por la izquierda mientras exceda el rango permitido.
        while (end - transactions[left].date).total_seconds() > window:
            left += 1

        # Cantidad de transacciones dentro de la ventana [left..right].
        count = right - left + 1
        # El limite depende de la franja horaria (manana/tarde/noche) del momento.
        band = get_time_band(end)
        threshold = threshold_for_band(band, config)

        if count >= threshold:
            # Rafaga detectada. Se extiende el episodio incluyendo las siguientes
            # transacciones que lleguen a <= 'window' segundos de la anterior.
            last = right
            while last + 1 < n and (
                transactions[last + 1].date - transactions[last].date
            ).total_seconds() <= window:
                last += 1

            episode = transactions[left:last + 1]
            ep_count = len(episode)
            total_value = sum((t.value for t in episode), Decimal('0'))
            anomalies.append(TransactionAnomaly(
                user=transactions[right].user,
                transaction_count=ep_count,
                window_seconds=window,
                threshold=threshold,
                time_band=band,
                level=_severity_level(ep_count, threshold),
                total_value=total_value,
                window_start=episode[0].date,
                window_end=episode[-1].date,
            ))
            # Continua despues del episodio completo (no se reporta dos veces).
            right = last + 1
            left = right
        else:
            right += 1

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
