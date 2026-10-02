from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Dict, List

from django.utils import timezone

from domain.entities.transaction import Transaction
from domain.interfaces.transaction_repository import ITransactionRepository
from application.use_cases.transaction_hash import is_valid_hash
from application.use_cases.detect_transaction_anomalies import detect_transaction_anomalies


@dataclass
class IngestResult:
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
) -> IngestResult:
    """
    Procesa un lote de transacciones:
      1. valida estructura y hash SHA-256 de cada una,
      2. descarta duplicadas (idTxn ya registrado),
      3. persiste las validas,
      4. corre la ventana deslizante por usuario y registra anomalias.
    """
    result = IngestResult()
    valid: List[Transaction] = []

    for item in payloads:
        try:
            txn = _parse_one(item)
        except (KeyError, ValueError, TypeError, InvalidOperation):
            result.rejected.append({'idTxn': item.get('idTxn'), 'reason': 'INVALID_PAYLOAD'})
            continue

        ok = is_valid_hash(
            txn.hash,
            str(item['idTxn']), txn.user, str(item['date']),
            str(item['value']), txn.payment_method,
        )
        if not ok:
            result.rejected.append({'idTxn': txn.id_txn, 'reason': 'INVALID_HASH'})
            continue

        if repo.id_txn_exists(txn.id_txn):
            result.rejected.append({'idTxn': txn.id_txn, 'reason': 'DUPLICATE'})
            continue

        valid.append(txn)

    if not valid:
        return result

    result.accepted = repo.save_transactions(valid)

    config = repo.get_config()
    anomalies = detect_transaction_anomalies(result.accepted, config)

    anomalous_ids = set()
    for anomaly in anomalies:
        repo.save_anomaly(anomaly)
        for txn in result.accepted:
            if (
                txn.user == anomaly.user
                and anomaly.window_start <= txn.date <= anomaly.window_end
            ):
                anomalous_ids.add(txn.id_txn)

    if anomalous_ids:
        repo.mark_transactions_anomalous(list(anomalous_ids))

    result.anomalies_detected = len(anomalies)
    return result
