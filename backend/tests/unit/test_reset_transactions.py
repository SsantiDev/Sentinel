from datetime import date

from django.test import override_settings

from application.use_cases.reset_transactions import reset_transactions
from infrastructure.tasks.transaction_tasks import _reset_cutoff, reset_transactions_task


class _FakeRepo:
    """Repo minimo: registra la llamada y devuelve conteos fijos."""

    def __init__(self):
        self.called = False

    def reset_all(self):
        self.called = True
        return (3, 2)


def test_reset_transactions_returns_counts():
    repo = _FakeRepo()
    result = reset_transactions(repo)
    assert repo.called is True
    assert result == {'deleted_transactions': 3, 'deleted_anomalies': 2}


@override_settings(TRANSACTIONS_RESET_UNTIL='2026-10-06')
def test_cutoff_parses_iso_date():
    assert _reset_cutoff() == date(2026, 10, 6)


@override_settings(TRANSACTIONS_RESET_UNTIL='')
def test_cutoff_empty_means_no_limit():
    assert _reset_cutoff() is None


@override_settings(TRANSACTIONS_RESET_UNTIL='2000-01-01')
def test_task_skips_after_cutoff():
    # Fecha limite en el pasado: la tarea no debe borrar nada.
    result = reset_transactions_task()
    assert result['status'] == 'skipped'
    assert result['reason'] == 'past cutoff'
