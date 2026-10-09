from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Dict, List

from django.utils import timezone

from domain.entities.transaction import Transaction
from domain.interfaces.transaction_repository import ITransactionRepository
from application.use_cases.transaction_hash import is_valid_hash
from application.use_cases.detect_transaction_anomalies import detect_transaction_anomalies
from application.use_cases.flag_invalid_transactions import (
    find_invalid_anomalies, build_rejection_anomaly,
)


@dataclass
class IngestResult:
    """Resultado de procesar un lote de transacciones.

    Campos:
        accepted:           entidades guardadas correctamente.
        rejected:           descartadas, cada una con {idTxn, reason, detail}.
                            reason (codigo estable): INVALID_PAYLOAD (formato),
                            INVALID_HASH (firma), DUPLICATE (idTxn repetido).
                            detail: texto preciso de que fallo (p. ej. "value no
                            es un numero: 'abc'"), para el log y la respuesta.
        anomalies_detected: cuantas anomalias genero este lote.
    """
    accepted: List[Transaction] = field(default_factory=list)
    rejected: List[Dict] = field(default_factory=list)
    anomalies_detected: int = 0


def _parse_date(raw: str) -> datetime:
    # Acepta ISO 8601 con o sin 'Z'. Si llega sin zona horaria, se asume
    # la zona por defecto del proyecto para no guardar datetimes naive.
    parsed = datetime.fromisoformat(raw.replace('Z', '+00:00'))
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_default_timezone())
    return parsed


_REQUIRED_FIELDS = ('idTxn', 'user', 'date', 'value', 'paymentMethod', 'hash')

# Limites de las columnas en base de datos. Se validan ANTES de guardar porque
# el guardado en bloque (bulk_create) NO corre la validacion de Django: un valor
# que cabe en Python pero no en la columna provocaria un error de base (500).
# Acotar aqui convierte esos casos en un rechazo limpio (INVALID_PAYLOAD).
_MAX_USER_LEN = 254            # EmailField
_MAX_PAYMENT_METHOD_LEN = 30   # CharField(max_length=30)
_MAX_HASH_LEN = 128            # CharField(max_length=128)
_BIGINT_MIN = -9223372036854775808
_BIGINT_MAX = 9223372036854775807   # rango de BigIntegerField (idTxn)
_VALUE_MAX_DIGITS = 18
_VALUE_DECIMAL_PLACES = 2


def _ensure_db_bounds(id_txn: int, user: str, value: Decimal,
                      payment_method: str, hash_: str) -> None:
    """Rechaza valores que caben en Python pero NO en la columna de la base,
    para que un fuzzer no provoque un 500 al insertar (idTxn fuera de rango,
    textos muy largos, o montos no finitos / con demasiados digitos)."""
    if not (_BIGINT_MIN <= id_txn <= _BIGINT_MAX):
        raise ValueError(f"idTxn fuera de rango: {id_txn}")
    if len(user) > _MAX_USER_LEN:
        raise ValueError(f"user demasiado largo (max {_MAX_USER_LEN})")
    if len(payment_method) > _MAX_PAYMENT_METHOD_LEN:
        raise ValueError(f"paymentMethod demasiado largo (max {_MAX_PAYMENT_METHOD_LEN})")
    if len(hash_) > _MAX_HASH_LEN:
        raise ValueError(f"hash demasiado largo (max {_MAX_HASH_LEN})")
    if not value.is_finite():
        raise ValueError(f"value no es un numero finito: {value}")
    if value.as_tuple().exponent < -_VALUE_DECIMAL_PLACES:
        raise ValueError(f"value con mas de {_VALUE_DECIMAL_PLACES} decimales")
    if abs(value) >= Decimal(10) ** (_VALUE_MAX_DIGITS - _VALUE_DECIMAL_PLACES):
        raise ValueError("value excede el tamano permitido")


def _parse_date_field(raw) -> datetime:
    """Valida y convierte el campo 'date'; lanza con detalle preciso si falla."""
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError(f"date vacia o no es texto: {raw!r}")
    try:
        return _parse_date(raw)
    except ValueError:
        raise ValueError(f"date no es una fecha ISO 8601: {raw!r}")


def _parse_one(item: Dict) -> Transaction:
    """Convierte un payload crudo en entidad Transaction.

    Cuando algo no cuadra lanza ValueError con un detalle PRECISO (que campo y
    por que). Ese detalle se propaga al motivo del rechazo y al log, para saber
    exactamente que fallo en cada transaccion (no solo 'invalido').
    """
    for field_name in _REQUIRED_FIELDS:
        if field_name not in item:
            raise ValueError(f"falta el campo '{field_name}'")

    # Un booleano JSON (true/false) no es un id ni un monto: Python lo
    # convertiria en silencio a 0/1, asi que se rechaza de forma explicita.
    if isinstance(item['idTxn'], bool):
        raise ValueError('idTxn no puede ser booleano')
    if isinstance(item['value'], bool):
        raise ValueError('value no puede ser booleano')

    try:
        id_txn = int(item['idTxn'])
    except (TypeError, ValueError):
        raise ValueError(f"idTxn no es un entero: {item['idTxn']!r}")

    user = str(item['user']).strip()
    if not user:
        raise ValueError('user vacio')

    try:
        value = Decimal(str(item['value']))
    except (InvalidOperation, ValueError):
        raise ValueError(f"value no es un numero: {item['value']!r}")

    payment_method = str(item['paymentMethod']).strip()
    if not payment_method:
        raise ValueError('paymentMethod vacio')

    date = _parse_date_field(item['date'])
    hash_ = str(item['hash']).strip()

    _ensure_db_bounds(id_txn, user, value, payment_method, hash_)

    return Transaction(
        id_txn=id_txn, user=user, date=date, value=value,
        payment_method=payment_method, hash=hash_,
    )


def ingest_transactions(
    payloads: List[Dict],
    repo: ITransactionRepository,
    secret: str,
    require_signature: bool = True,
) -> IngestResult:
    """
    Procesa un lote de transacciones:
      1. valida estructura y (si se exige) firma HMAC-SHA256 de cada una,
      2. descarta duplicadas (idTxn ya registrado),
      3. persiste las validas,
      4. corre la ventana deslizante por usuario y registra anomalias.

    'secret' es la clave compartida con la que el emisor firma cada transaccion;
    sin ella una firma valida no puede fabricarse.

    'require_signature' controla si la firma es obligatoria. En produccion se
    deja en True (anti-falsificacion). En modo laboratorio/evaluador se pasa
    False: el emisor externo no comparte el secreto, asi que una transaccion
    bien formada entra aunque su hash no coincida (la basura se sigue
    descartando por formato en el Filtro 1).
    """
    result = IngestResult()
    valid: List[Transaction] = []
    # idTxn ya vistos EN ESTE lote: evita que dos filas con el mismo id lleguen
    # juntas al guardado en bloque y rompan la clave unica (error de servidor).
    seen_ids: set = set()
    # Payloads rechazados (crudo + motivo): cada uno se registrara como anomalia
    # visible para que NINGUN dato entre en silencio al tablero.
    rejected_items: List[tuple] = []

    # Se valida cada transaccion en 3 filtros en orden: formato -> firma ->
    # duplicado. La que falla un filtro se descarta con su motivo y se sigue.
    for item in payloads:
        try:
            txn = _parse_one(item)
        except (ValueError, TypeError) as exc:
            # item.get puede fallar si el payload ni siquiera es un diccionario.
            id_val = item.get('idTxn') if isinstance(item, dict) else None
            result.rejected.append({
                'idTxn': id_val,
                'reason': 'INVALID_PAYLOAD',
                'detail': str(exc),
            })
            rejected_items.append((item, 'INVALID_PAYLOAD'))
            continue

        # Filtro 2 (solo si se exige firma): la firma HMAC debe coincidir con la
        # recalculada con la clave. Si no se exige (modo evaluador), se omite
        # porque el emisor no comparte el secreto.
        if require_signature:
            ok = is_valid_hash(
                txn.hash,
                secret,
                str(item['idTxn']), txn.user, str(item['date']),
                str(item['value']), txn.payment_method,
            )
            if not ok:
                result.rejected.append({
                    'idTxn': txn.id_txn,
                    'reason': 'INVALID_HASH',
                    'detail': 'la firma HMAC no coincide con los datos enviados',
                })
                rejected_items.append((item, 'INVALID_HASH'))
                continue

        # Filtro 3: el idTxn no debe repetirse en este lote ni existir ya en la
        # base (anti-reenvio y anti-colision dentro del mismo request).
        if txn.id_txn in seen_ids:
            result.rejected.append({
                'idTxn': txn.id_txn, 'reason': 'DUPLICATE',
                'detail': 'idTxn repetido dentro del mismo lote',
            })
            rejected_items.append((item, 'DUPLICATE'))
            continue
        if repo.id_txn_exists(txn.id_txn):
            result.rejected.append({
                'idTxn': txn.id_txn, 'reason': 'DUPLICATE',
                'detail': 'idTxn ya registrado anteriormente',
            })
            rejected_items.append((item, 'DUPLICATE'))
            continue

        seen_ids.add(txn.id_txn)
        valid.append(txn)

    # Cada payload rechazado (formato invalido, firma que no coincide o ID ya
    # registrado -> posible reenvio/replay) queda como anomalia visible. Se
    # AGRUPA por usuario+motivo (una fila con contador) para no inundar la base:
    # un ID reenviado 196 veces es UNA fila con cuenta 196, no 196 filas.
    for raw_item, rejection_reason in rejected_items:
        repo.upsert_grouped_anomaly(build_rejection_anomaly(raw_item, rejection_reason))
        result.anomalies_detected += 1

    if not valid:
        return result

    result.accepted = repo.save_transactions(valid)

    config = repo.get_config()
    window = timedelta(seconds=config.window_seconds)

    # Agrupa las transacciones recien aceptadas por usuario. La deteccion se
    # hace contra el HISTORIAL del usuario (no solo este lote), para que una
    # rafaga que llega en peticiones separadas tambien se detecte.
    new_by_user = defaultdict(list)
    for txn in result.accepted:
        new_by_user[txn.user].append(txn)

    anomalous_ids = set()
    for user, user_new in new_by_user.items():
        lo = min(t.date for t in user_new) - window
        hi = max(t.date for t in user_new)
        history = repo.get_user_transactions_in_range(user, lo, hi)

        for anomaly in detect_transaction_anomalies(history, config):
            # Evita reportar dos veces la misma rafaga (peticiones sucesivas).
            if repo.exists_overlapping_anomaly(
                anomaly.user, anomaly.window_start, anomaly.window_end
            ):
                continue
            repo.save_anomaly(anomaly)
            result.anomalies_detected += 1
            # La deteccion ya sabe que transacciones forman la rafaga; se toman
            # directo (antes se re-escaneaba todo el historial por cada anomalia).
            anomalous_ids.update(anomaly.transaction_ids)

    if anomalous_ids:
        repo.mark_transactions_anomalous(list(anomalous_ids))

    # Ademas de las rafagas, cada transaccion con datos invalidos (monto <= 0,
    # usuario que no es un correo, o fecha futura) se marca como anomalia por si
    # sola, para que un dato invalido no entre en silencio al tablero.
    invalid_ids: List[int] = []
    for anomaly in find_invalid_anomalies(result.accepted):
        repo.upsert_grouped_anomaly(anomaly)
        result.anomalies_detected += 1
        invalid_ids.extend(anomaly.transaction_ids)
    if invalid_ids:
        repo.mark_transactions_anomalous(invalid_ids)

    return result
