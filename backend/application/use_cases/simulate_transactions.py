from datetime import datetime, timedelta
from typing import Dict, List

from application.use_cases.transaction_hash import compute_transaction_hash


def build_signed_transactions(
    secret: str,
    *,
    user: str,
    value: int,
    payment_method: str,
    base_date: datetime,
    count: int,
    interval_seconds: int,
    base_id: int,
) -> List[Dict]:
    """
    Construye 'count' transacciones firmadas en el servidor para el simulador
    del front. La firma se calcula aqui con la clave secreta, de modo que el
    navegador (publico) nunca necesita conocerla.

    Parametros:
        secret:           clave secreta con la que se firma cada transaccion (HMAC).
        user:             correo del usuario al que pertenecen las transacciones.
        value:            monto (igual en todas las generadas).
        payment_method:   metodo de pago (Tarjeta, Efectivo, etc.).
        base_date:        fecha/hora de la primera transaccion.
        count:            cuantas transacciones generar.
        interval_seconds: segundos entre una transaccion y la siguiente. Con un
                          valor pequeno (p. ej. 0) se concentran y disparan una
                          anomalia; espaciadas, no.
        base_id:          idTxn de la primera; las siguientes son base_id+1, +2...
                          (debe ser unico por llamada para no chocar con duplicados).

    Devuelve una lista de diccionarios listos para ingestar (mismo formato que
    envia un cliente externo), cada uno con su campo 'hash' ya firmado.
    """
    payloads: List[Dict] = []
    for i in range(count):
        moment = base_date + timedelta(seconds=i * interval_seconds)
        date_str = moment.strftime('%Y-%m-%dT%H:%M:%S')
        id_txn = base_id + i
        signature = compute_transaction_hash(
            secret, str(id_txn), user, date_str, str(value), payment_method,
        )
        payloads.append({
            'idTxn': id_txn,
            'user': user,
            'date': date_str,
            'value': value,
            'paymentMethod': payment_method,
            'hash': signature,
        })
    return payloads
