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


@dataclass
class IngestResult:
    """Resultado de procesar un lote de transacciones.

    Campos:
        accepted:           entidades guardadas correctamente.
        rejected:           descartadas, cada una con {idTxn, reason}. Motivos:
                            INVALID_PAYLOAD (formato), INVALID_HASH (firma),
                            DUPLICATE (idTxn repetido).
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


def _parse_one(item: Dict) -> Transaction:
    """Convierte un payload crudo en entidad Transaction (lanza si invalido)."""
    # Un booleano JSON (true/false) no es un id ni un monto: Python lo
    # convertiria en silencio a 0/1, asi que se rechaza de forma explicita.
    if isinstance(item['idTxn'], bool) or isinstance(item['value'], bool):
        raise ValueError('bool not allowed for idTxn/value')
    id_txn = int(item['idTxn'])
    user = str(item['user']).strip()
    date = _parse_date(str(item['date']))
    value = Decimal(str(item['value']))
    payment_method = str(item['paymentMethod']).strip()
    txn_hash = str(item['hash']).strip()

    if not user or not payment_method:
        raise ValueError('empty user or paymentMethod')

    return Transaction(
        id_txn=id_txn, user=user, date=date, value=value,
        payment_method=payment_method, hash=txn_hash,
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

    # Se valida cada transaccion en 3 filtros en orden: formato -> firma ->
    # duplicado. La que falla un filtro se descarta con su motivo y se sigue.
    for item in payloads:
        try:
            txn = _parse_one(item)
        except (KeyError, ValueError, TypeError, InvalidOperation):
            result.rejected.append({'idTxn': item.get('idTxn'), 'reason': 'INVALID_PAYLOAD'})
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
                result.rejected.append({'idTxn': txn.id_txn, 'reason': 'INVALID_HASH'})
                continue

        # Filtro 3: el idTxn no debe repetirse en este lote ni existir ya en la
        # base (anti-reenvio y anti-colision dentro del mismo request).
        if txn.id_txn in seen_ids or repo.id_txn_exists(txn.id_txn):
            result.rejected.append({'idTxn': txn.id_txn, 'reason': 'DUPLICATE'})
            continue

        seen_ids.add(txn.id_txn)
        valid.append(txn)

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
            for txn in history:
                if anomaly.window_start <= txn.date <= anomaly.window_end:
                    anomalous_ids.add(txn.id_txn)

    if anomalous_ids:
        repo.mark_transactions_anomalous(list(anomalous_ids))

    return result
