from typing import List, Optional

from domain.entities.analytics import IncidentPeriod
from domain.entities.service import CheckResult, ServiceStatus
from domain.interfaces.service_repository import IServiceRepository


def _bisect_incident_start(checks: List[CheckResult], lo: int, hi: int, ops: List[int]) -> int:
    """Biseccion recursiva: encuentra el primer indice DOWN de una racha continua
    que termina en hi. Precondicion: checks[hi] esta DOWN y la caida es continua
    hasta hi (sin altibajos intermedios) — valido para detectar el inicio del
    incidente activo actual. O(log n), peor caso profundidad log2(n)."""
    ops[0] += 1
    if lo == hi:
        return lo
    mid = (lo + hi) // 2
    if checks[mid].status == ServiceStatus.DOWN: # SI ESTA DOWN
        return _bisect_incident_start(checks, lo, mid, ops)
    return _bisect_incident_start(checks, mid + 1, hi, ops) # SI ESTA UP


def find_incident_start(
    service_id: int, repo: IServiceRepository, window: int = 200 # LIMITE DE CHECKS 
) -> Optional[IncidentPeriod]:
    checks = repo.get_checks_for_service(service_id, limit=window) # OBTIENE LOS CHECKS 
    if not checks or checks[-1].status != ServiceStatus.DOWN:
        return None # SI NO HAY CHECKS O EL ULTIMO NO ESTA DOWN

    ops = [0] 
    start_index = _bisect_incident_start(checks, 0, len(checks) - 1, ops) # ENCUENTRA EL INCIDENTE

    return IncidentPeriod(
        service_id=service_id,
        start_check=checks[start_index],
        is_ongoing=True,
        operations_count=ops[0],
    )
