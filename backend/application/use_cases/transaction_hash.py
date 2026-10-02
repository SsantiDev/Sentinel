import hashlib
import hmac


def compute_transaction_hash(
    secret: str,
    id_txn: str,
    user: str,
    date: str,
    value: str,
    payment_method: str,
) -> str:
    """
    Calcula la firma HMAC-SHA256 de una transaccion usando una clave secreta.

    El mensaje se arma concatenando los campos en orden fijo separados por
    '|' exactamente como llegan en el payload (como texto). A diferencia de un
    hash plano, la firma depende de una clave secreta compartida solo entre el
    servidor y el emisor legitimo, de modo que un tercero sin la clave no puede
    producir una firma valida (no puede falsificar transacciones):

        hmac_sha256( secret, "idTxn|user|date|value|paymentMethod" )
    """
    message = '|'.join([id_txn, user, date, value, payment_method])
    return hmac.new(
        secret.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()


def is_valid_hash(
    expected_hash: str,
    secret: str,
    id_txn: str,
    user: str,
    date: str,
    value: str,
    payment_method: str,
) -> bool:
    """Compara (en tiempo constante) la firma recibida contra la recalculada."""
    computed = compute_transaction_hash(secret, id_txn, user, date, value, payment_method)
    return hmac.compare_digest(computed, (expected_hash or '').lower())
