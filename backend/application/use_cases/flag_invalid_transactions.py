import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional

from django.utils import timezone

from domain.entities.transaction import Transaction, TransactionAnomaly
from application.use_cases.time_band import get_time_band

# Motivo con el que se guardan estas anomalias (las rafagas usan 'burst').
INVALID_REASON = 'invalid_data'

# Traduce el codigo de rechazo de la ingesta al motivo de la anomalia visible.
# Asi un dato que no se puede guardar (formato, firma o ID repetido) igual deja
# rastro en el tablero en vez de desaparecer.
REASON_BY_REJECTION = {
    'INVALID_PAYLOAD': 'invalid_data',
    'INVALID_HASH': 'invalid_signature',
    'DUPLICATE': 'duplicate_id',
}

# Correo minimamente valido: algo@algo.algo. No pretende ser exhaustivo; solo
# descarta identidades que claramente no son un correo (p. ej. 'null', 'True').
_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def _invalid_detail(txn: Transaction, now: datetime) -> Optional[str]:
    """Devuelve el motivo si la transaccion tiene datos invalidos, o None.

    Reglas (una transaccion es invalida si):
        - su monto es <= 0            -> no corresponde a un cobro real,
        - su usuario no es un correo  -> identidad invalida (p. ej. 'null'),
        - su fecha esta en el futuro  -> imposible.
    """
    if txn.value <= Decimal('0'):
        return 'monto no positivo'
    if not _EMAIL_RE.match(txn.user):
        return 'usuario no es un correo valido'
    if txn.date > now:
        return 'fecha en el futuro'
    return None


def _to_invalid_anomaly(txn: Transaction, now: datetime) -> TransactionAnomaly:
    """Arma la anomalia de 'dato invalido' para una transaccion (cuenta = 1)."""
    value = txn.value if txn.value.is_finite() else Decimal('0')
    return TransactionAnomaly(
        user=(txn.user or 'desconocido')[:254],
        transaction_count=1,
        window_seconds=0,
        threshold=0,
        time_band=get_time_band(now),
        level='high',
        total_value=value,
        window_start=now,
        window_end=now,
        reason=INVALID_REASON,
        transaction_ids=[txn.id_txn],
    )


def find_invalid_anomalies(transactions: List[Transaction]) -> List[TransactionAnomaly]:
    """Crea una anomalia por cada transaccion con datos invalidos.

    A diferencia de una rafaga (varias transacciones concentradas en una
    ventana), cada transaccion invalida es una anomalia por si sola, para que
    quede VISIBLE en el tablero en vez de entrar en silencio.
    """
    now = timezone.now()
    anomalies: List[TransactionAnomaly] = []
    for txn in transactions:
        if _invalid_detail(txn, now) is not None:
            anomalies.append(_to_invalid_anomaly(txn, now))
    return anomalies


def _safe_user(item) -> str:
    """Extrae el usuario de un payload crudo (aunque no sea un diccionario)."""
    try:
        raw = item.get('user')
    except AttributeError:
        return 'desconocido'
    text = str(raw).strip() if raw is not None else ''
    return text[:254] if text else 'desconocido'


def _safe_value(item) -> Decimal:
    """Extrae el monto de un payload crudo y lo acota a la columna de la anomalia.

    La anomalia guarda 'total_value' como DecimalField(max_digits=18, 2 dec). Un
    monto que no quepa (gigante, con muchos decimales o no finito) se registra en
    0 para que un payload invalido NUNCA provoque un error de base (500).
    """
    try:
        raw = item.get('value')
    except AttributeError:
        return Decimal('0')
    try:
        value = Decimal(str(raw))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal('0')
    if not value.is_finite():
        return Decimal('0')
    if value.as_tuple().exponent < -2:
        return Decimal('0')
    if abs(value) >= Decimal(10) ** 16:
        return Decimal('0')
    return value


def _safe_id(item) -> Optional[int]:
    """Extrae el idTxn de un payload crudo; None si no es un entero."""
    try:
        raw = item.get('idTxn')
    except AttributeError:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def build_rejection_anomaly(item: Dict, rejection_reason: str) -> TransactionAnomaly:
    """Convierte un payload RECHAZADO en una anomalia visible.

    Un dato que la ingesta no puede guardar (formato invalido, firma que no
    coincide, o un ID ya registrado -> posible reenvio/replay) tambien debe
    quedar en el tablero. Se arma una anomalia de cuenta 1 con el motivo que
    corresponde ('invalid_data', 'invalid_signature' o 'duplicate_id').
    """
    now = timezone.now()
    return TransactionAnomaly(
        user=_safe_user(item),
        transaction_count=1,
        window_seconds=0,
        threshold=0,
        time_band=get_time_band(now),
        level='high',
        total_value=_safe_value(item),
        window_start=now,
        window_end=now,
        reason=REASON_BY_REJECTION.get(rejection_reason, 'invalid_data'),
        transaction_ids=[tid] if (tid := _safe_id(item)) is not None else [],
    )
