from application.use_cases.transaction_hash import (
    compute_transaction_hash, is_valid_hash,
)

SECRET = 'test-secret-key'


def test_hash_is_deterministic():
    args = ('10001', 'aa@aa.com', '2026-09-23T10:30:01.120', '50000', 'Tarjeta')
    assert compute_transaction_hash(SECRET, *args) == compute_transaction_hash(SECRET, *args)


def test_valid_hash_passes():
    args = ('10001', 'aa@aa.com', '2026-09-23T10:30:01.120', '50000', 'Tarjeta')
    expected = compute_transaction_hash(SECRET, *args)
    assert is_valid_hash(expected, SECRET, *args) is True


def test_tampered_value_fails_hash():
    args = ('10001', 'aa@aa.com', '2026-09-23T10:30:01.120', '50000', 'Tarjeta')
    expected = compute_transaction_hash(SECRET, *args)
    tampered = ('10001', 'aa@aa.com', '2026-09-23T10:30:01.120', '999999', 'Tarjeta')
    assert is_valid_hash(expected, SECRET, *tampered) is False


def test_empty_hash_fails():
    args = ('10001', 'aa@aa.com', '2026-09-23T10:30:01.120', '50000', 'Tarjeta')
    assert is_valid_hash('', SECRET, *args) is False


def test_wrong_secret_fails_hash():
    # Un atacante sin la clave correcta no puede producir una firma valida.
    args = ('10001', 'aa@aa.com', '2026-09-23T10:30:01.120', '50000', 'Tarjeta')
    forged = compute_transaction_hash('otra-clave', *args)
    assert is_valid_hash(forged, SECRET, *args) is False
