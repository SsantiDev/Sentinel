import logging
from datetime import date
from typing import Optional

from django.conf import settings
from django.utils import timezone

from config.celery import app
from application.use_cases.reset_transactions import reset_transactions
from infrastructure.repositories.transaction_repository import DjangoTransactionRepository

logger = logging.getLogger(__name__)


def _reset_cutoff() -> Optional[date]:
    """Fecha limite (inclusive) del reset, o None si no hay limite configurado."""
    raw = (settings.TRANSACTIONS_RESET_UNTIL or '').strip()
    if not raw:
        return None
    return date.fromisoformat(raw)


@app.task
def reset_transactions_task():
    """Reset horario del entorno de evaluacion: borra transacciones y anomalias.

    Se auto-desactiva: pasada TRANSACTIONS_RESET_UNTIL no borra nada, para quedar
    inofensiva despues de la demo sin tener que retirarla del calendario.
    """
    cutoff = _reset_cutoff()
    if cutoff and timezone.localdate() > cutoff:
        logger.info("Reset de transacciones omitido: pasada la fecha limite %s", cutoff.isoformat())
        return {"status": "skipped", "reason": "past cutoff"}

    result = reset_transactions(DjangoTransactionRepository())
    logger.info(
        "Reset de transacciones: %d transacciones y %d anomalias borradas",
        result["deleted_transactions"], result["deleted_anomalies"],
    )
    return {"status": "done", **result}
