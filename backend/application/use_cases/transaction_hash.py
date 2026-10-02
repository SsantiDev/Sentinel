import hashlib
import hmac

HASH_FIELD_ORDER = ('id_txn', 'user', 'date', 'value', 'payment_method')


def compute_transaction_hash(
    id_txn: str,
    user: str,
    date: str,
    value: str,
    payment_method: str,
) -> str:
    """
    Calcula el SHA-256 de una transaccion.

    El mensaje se arma concatenando los campos en orden fijo separados por
    '|' exactamente como llegan en el payload (como texto), de modo que el
    hash sea determinista y reproducible por el emisor:

        sha256( "idTxn|user|date|value|paymentMethod" )
    """
    message = '|'.join([id_txn, user, date, value, payment_method])
    return hashlib.sha256(message.encode('utf-8')).hexdigest()


def is_valid_hash(
    expected_hash: str,
    id_txn: str,
    user: str,
    date: str,
    value: str,
    payment_method: str,
) -> bool:
    """Compara (en tiempo constante) el hash recibido contra el recalculado."""
    computed = compute_transaction_hash(id_txn, user, date, value, payment_method)
    return hmac.compare_digest(computed, (expected_hash or '').lower())
