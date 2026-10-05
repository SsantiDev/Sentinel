from domain.interfaces.transaction_repository import ITransactionRepository


def reset_transactions(repo: ITransactionRepository) -> dict:
    """Borra todas las transacciones y anomalias; devuelve cuantas elimino.

    Deja el entorno de evaluacion limpio para que el bot pueda reenviar el mismo
    lote y recibir 201 (en vez de rechazos por duplicado que acaban en 422).
    """
    deleted_transactions, deleted_anomalies = repo.reset_all()
    return {
        'deleted_transactions': deleted_transactions,
        'deleted_anomalies': deleted_anomalies,
    }
