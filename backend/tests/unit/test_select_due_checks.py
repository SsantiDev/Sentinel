from datetime import datetime, timedelta

from application.use_cases.select_due_checks import select_due_checks

NOW = datetime(2026, 1, 1, 12, 0, 0)


def test_never_checked_service_is_always_due():
    result = select_due_checks([(1, None, 60)], NOW)
    assert result.due_service_ids == [1]


def test_only_services_past_their_interval_are_due():
    candidates = [
        (1, NOW - timedelta(seconds=120), 60),   # vencido
        (2, NOW - timedelta(seconds=30), 60),    # todavia no
        (3, NOW - timedelta(seconds=300), 60),   # vencido
    ]
    result = select_due_checks(candidates, NOW)
    assert set(result.due_service_ids) == {1, 3}
    assert result.total_scheduled == 3


def test_due_services_come_out_in_priority_order():
    candidates = [
        (1, NOW - timedelta(seconds=90), 60),    # vencio hace 30s
        (2, NOW - timedelta(seconds=600), 60),   # vencio hace 540s (mas atrasado)
        (3, NOW - timedelta(seconds=180), 60),   # vencio hace 120s
    ]
    result = select_due_checks(candidates, NOW)
    assert result.due_service_ids == [2, 3, 1]


def test_lookahead_includes_services_due_before_next_tick():
    # Servicio revisado hace 30s, intervalo 60: vence en 30s. Sin lookahead no
    # entra; con lookahead de 60s (una vuelta del reloj) si entra.
    candidates = [(1, NOW - timedelta(seconds=30), 60)]
    assert select_due_checks(candidates, NOW).due_service_ids == []
    assert select_due_checks(candidates, NOW, lookahead_seconds=60).due_service_ids == [1]


def test_lookahead_still_respects_longer_intervals():
    # Intervalo 300, revisado hace 30s: no entra ni con lookahead de 60s.
    candidates = [(1, NOW - timedelta(seconds=30), 300)]
    assert select_due_checks(candidates, NOW, lookahead_seconds=60).due_service_ids == []


def test_empty_input_returns_nothing():
    result = select_due_checks([], NOW)
    assert result.due_service_ids == []
    assert result.total_scheduled == 0


def test_operation_count_is_bounded_when_few_are_due():
    # 100 servicios, solo 1 vencido: heapify (100) + 1 pop + 1 peek fallido ~ 102,
    # muy por debajo de las ~100 log2(100) de ordenar todo.
    candidates = [(i, NOW - timedelta(seconds=10), 60) for i in range(100)]
    candidates[0] = (0, None, 60)
    result = select_due_checks(candidates, NOW)
    assert result.due_service_ids == [0]
    assert result.operations_count <= 102
