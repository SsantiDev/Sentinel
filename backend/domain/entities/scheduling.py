from dataclasses import dataclass
from datetime import datetime
from typing import List


@dataclass(frozen=True)
class ScheduledCheck:
    """Una revision pendiente en el turnero: cuando le toca a un servicio."""
    service_id: int
    due_at: datetime


@dataclass
class DueCheckSelection:
    """Resultado de vaciar el turnero: que servicios estan vencidos ahora."""
    due_service_ids: List[int]
    total_scheduled: int
    operations_count: int
