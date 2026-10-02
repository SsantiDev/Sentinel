import time
from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from domain.entities.transaction import DetectionConfig, Transaction
from application.use_cases.detect_transaction_anomalies import detect_transaction_anomalies

CONFIG = DetectionConfig(window_seconds=3, morning_limit=10, afternoon_limit=6, night_limit=3)


def _build_dataset(n_users: int, per_user: int):
    """Genera n_users * per_user transacciones repartidas en el tiempo."""
    base = datetime(2026, 9, 23, 10, 0, 0)
    txns = []
    tid = 0
    for u in range(n_users):
        user = f'user{u}@x.com'
        for i in range(per_user):
            tid += 1
            # transacciones espaciadas 5s -> trafico NORMAL (sin anomalias)
            txns.append(Transaction(
                id_txn=tid, user=user, date=base + timedelta(seconds=i * 5),
                value=Decimal('100'), payment_method='Tarjeta', hash='x',
            ))
    return txns


@pytest.mark.slow
def test_detection_scales_linearly_many_users():
    # 200.000 transacciones (2.000 usuarios x 100 c/u)
    txns = _build_dataset(n_users=2000, per_user=100)
    assert len(txns) == 200_000

    start = time.perf_counter()
    anomalies = detect_transaction_anomalies(txns, CONFIG)
    elapsed = time.perf_counter() - start

    # Trafico normal -> ninguna anomalia, y debe resolverse rapido.
    assert anomalies == []
    assert elapsed < 15.0, f'demasiado lento: {elapsed:.2f}s'


@pytest.mark.slow
def test_detection_finds_all_bursts_at_scale():
    # 1.000 usuarios, cada uno con una rafaga de 5 transacciones en 2s (noche)
    base = datetime(2026, 9, 23, 21, 0, 0)
    txns = []
    tid = 0
    for u in range(1000):
        user = f'burst{u}@x.com'
        for i in range(5):
            tid += 1
            txns.append(Transaction(
                id_txn=tid, user=user, date=base + timedelta(milliseconds=i * 400),
                value=Decimal('100'), payment_method='Tarjeta', hash='x',
            ))

    anomalies = detect_transaction_anomalies(txns, CONFIG)
    # Una anomalia por usuario (franja noche, limite 3).
    assert len(anomalies) == 1000
