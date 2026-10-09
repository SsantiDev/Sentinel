from datetime import datetime, timedelta
from decimal import Decimal

from domain.entities.transaction import DetectionConfig, Transaction
from application.use_cases.detect_transaction_anomalies import detect_transaction_anomalies


def _txn(id_txn, user, dt, value=100):
    return Transaction(
        id_txn=id_txn, user=user, date=dt, value=Decimal(value),
        payment_method='Tarjeta', hash='x',
    )


# Ventana de 3s; limite 3 en todas las franjas para probar la regla base.
CONFIG = DetectionConfig(window_seconds=3, morning_limit=3, afternoon_limit=3, night_limit=3)


def test_case1_multiple_transactions_same_user_is_anomaly():
    txns = [
        _txn(1, 'b@b.com', datetime(2026, 9, 23, 10, 0, 1)),
        _txn(2, 'b@b.com', datetime(2026, 9, 23, 10, 0, 2)),
        _txn(3, 'b@b.com', datetime(2026, 9, 23, 10, 0, 3)),
    ]
    anomalies = detect_transaction_anomalies(txns, CONFIG)
    assert len(anomalies) == 1
    assert anomalies[0].user == 'b@b.com'
    assert anomalies[0].transaction_count == 3
    # La deteccion expone las transacciones de la rafaga (la ingesta las usa
    # para marcarlas sin re-escanear el historial).
    assert anomalies[0].transaction_ids == [1, 2, 3]


def test_case2_spread_transactions_are_normal():
    txns = [
        _txn(1, 'c@c.com', datetime(2026, 9, 23, 10, 0, 1)),
        _txn(2, 'c@c.com', datetime(2026, 9, 23, 10, 0, 10)),
        _txn(3, 'c@c.com', datetime(2026, 9, 23, 10, 1, 20)),
    ]
    assert detect_transaction_anomalies(txns, CONFIG) == []


def test_transactions_not_concentrated_in_window_are_normal():
    txns = [
        _txn(1, 'b@b.com', datetime(2026, 9, 23, 10, 0, 1)),
        _txn(2, 'b@b.com', datetime(2026, 9, 23, 10, 0, 5)),
        _txn(3, 'b@b.com', datetime(2026, 9, 23, 10, 0, 9)),
    ]
    assert detect_transaction_anomalies(txns, CONFIG) == []


def test_windows_are_independent_per_user():
    txns = [
        _txn(1, 'u1@x.com', datetime(2026, 9, 23, 10, 0, 1)),
        _txn(2, 'u1@x.com', datetime(2026, 9, 23, 10, 0, 2)),
        _txn(3, 'u1@x.com', datetime(2026, 9, 23, 10, 0, 3)),
        _txn(4, 'u2@x.com', datetime(2026, 9, 23, 10, 0, 1)),
        _txn(5, 'u2@x.com', datetime(2026, 9, 23, 10, 0, 2)),
    ]
    anomalies = detect_transaction_anomalies(txns, CONFIG)
    assert len(anomalies) == 1
    assert anomalies[0].user == 'u1@x.com'


def test_time_band_limit_applies_morning_allows_more():
    # Franja manana con limite 10: tres transacciones NO son anomalia.
    config = DetectionConfig(window_seconds=3, morning_limit=10, afternoon_limit=6, night_limit=3)
    txns = [
        _txn(1, 'b@b.com', datetime(2026, 9, 23, 10, 0, 1)),
        _txn(2, 'b@b.com', datetime(2026, 9, 23, 10, 0, 2)),
        _txn(3, 'b@b.com', datetime(2026, 9, 23, 10, 0, 3)),
    ]
    assert detect_transaction_anomalies(txns, config) == []


def test_night_band_limit_three_triggers():
    config = DetectionConfig(window_seconds=3, morning_limit=10, afternoon_limit=6, night_limit=3)
    txns = [
        _txn(1, 'b@b.com', datetime(2026, 9, 23, 21, 0, 1)),
        _txn(2, 'b@b.com', datetime(2026, 9, 23, 21, 0, 2)),
        _txn(3, 'b@b.com', datetime(2026, 9, 23, 21, 0, 3)),
    ]
    anomalies = detect_transaction_anomalies(txns, config)
    assert len(anomalies) == 1
    assert anomalies[0].time_band == 'night'
    assert anomalies[0].total_value == Decimal('300')


def test_sustained_burst_is_a_single_anomaly():
    # 6 transacciones seguidas (limite 3) = UNA sola anomalia que cubre las 6.
    txns = [_txn(i, 'b@b.com', datetime(2026, 9, 23, 10, 0, 0, i * 100_000)) for i in range(6)]
    anomalies = detect_transaction_anomalies(txns, CONFIG)
    assert len(anomalies) == 1
    assert anomalies[0].transaction_count == 6


def test_long_burst_splits_into_multiple_windows():
    # 10 transacciones cada 0.5s abarcan 4.5s: mas de una ventana de 3s. Antes
    # colapsaban en 1 sola anomalia; ahora se reparten en ventanas no solapadas,
    # y la ventana mas concentrada sale con mayor nivel.
    base = datetime(2026, 9, 23, 21, 0, 0)
    txns = [_txn(i, 'b@b.com', base + timedelta(seconds=i * 0.5)) for i in range(10)]
    anomalies = detect_transaction_anomalies(txns, CONFIG)
    assert len(anomalies) == 2
    assert anomalies[0].transaction_count == 7
    assert anomalies[0].level == 'high'
    assert anomalies[1].transaction_count == 3


def test_two_separate_bursts_are_two_anomalies():
    # Dos rafagas separadas por un hueco mayor a la ventana -> dos anomalias.
    txns = [
        _txn(1, 'b@b.com', datetime(2026, 9, 23, 10, 0, 0)),
        _txn(2, 'b@b.com', datetime(2026, 9, 23, 10, 0, 1)),
        _txn(3, 'b@b.com', datetime(2026, 9, 23, 10, 0, 2)),
        # hueco de 20s (> ventana) -> nuevo episodio
        _txn(4, 'b@b.com', datetime(2026, 9, 23, 10, 0, 22)),
        _txn(5, 'b@b.com', datetime(2026, 9, 23, 10, 0, 23)),
        _txn(6, 'b@b.com', datetime(2026, 9, 23, 10, 0, 24)),
    ]
    anomalies = detect_transaction_anomalies(txns, CONFIG)
    assert len(anomalies) == 2
