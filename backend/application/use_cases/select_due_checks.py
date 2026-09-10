import heapq
from datetime import datetime, timedelta
from typing import Iterable, List, Optional, Tuple

from domain.entities.scheduling import DueCheckSelection

SchedulingCandidate = Tuple[int, Optional[datetime], int]


def _due_at(last_checked_at: Optional[datetime], interval_seconds: int, now: datetime) -> datetime:
    """Cuando le toca la proxima revision. Si nunca fue revisado, le toca ya."""
    if last_checked_at is None:
        return now
    return last_checked_at + timedelta(seconds=interval_seconds)


def select_due_checks(
    candidates: Iterable[SchedulingCandidate],
    now: datetime,
    lookahead_seconds: float = 0.0,
) -> DueCheckSelection:
    """Cola de prioridad (min-heap) ordenada por 'due_at'.

    Construye el heap con todos los servicios activos (heapify O(n)) y extrae
    los que vencen dentro del horizonte 'now + lookahead_seconds': mientras la
    cima este dentro (due_at <= horizonte), hace pop. Peek de la cima O(1);
    cada pop O(log n). Si k servicios entran, el costo es O(n + k log n) — mas
    barato que ordenar todo cuando k es chico, que es el caso normal.

    'lookahead_seconds' deja incluir lo que vencera antes de la proxima corrida
    del reloj (el beat). Con beat cada 60s y lookahead 60, un servicio de
    intervalo 60 entra en cada corrida; uno de intervalo 300, cada 5.
    """
    horizon = now + timedelta(seconds=lookahead_seconds)
    heap: List[Tuple[datetime, int]] = []
    operations = 0

    for service_id, last_checked_at, interval_seconds in candidates:
        heap.append((_due_at(last_checked_at, interval_seconds, now), service_id))
        operations += 1

    heapq.heapify(heap)
    total_scheduled = len(heap)

    due_service_ids: List[int] = []
    while heap and heap[0][0] <= horizon:
        _, service_id = heapq.heappop(heap)
        due_service_ids.append(service_id)
        operations += 1

    return DueCheckSelection(
        due_service_ids=due_service_ids,
        total_scheduled=total_scheduled,
        operations_count=operations,
    )
