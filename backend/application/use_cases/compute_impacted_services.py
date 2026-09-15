from collections import deque
from typing import Dict, Iterable, List, Tuple

from domain.entities.service import ImpactAnalysis

DependencyEdge = Tuple[int, int]  # (service_id, depends_on_id)


def compute_impacted_services(
    edges: Iterable[DependencyEdge],
    down_service_ids: Iterable[int],
) -> ImpactAnalysis:
    """BFS sobre el grafo de dependencias, en reversa.

    Si el servicio A depende del B (arista A -> B) y B esta caido, A queda
    'impactado'. Se parte de cada servicio caido y se camina hacia quienes
    dependen de el (y de sus dependientes, y asi), marcando visitados para
    no repetir trabajo aunque el grafo tenga ciclos.
    """
    # Mapa (diccionario): por cada id de servicio, guarda un array con los ids
    # de quienes dependen de el. Es el grafo "al reves" para poder caminar
    # desde el caido hacia sus dependientes.
    dependents: Dict[int, List[int]] = {}
    for service_id, depends_on_id in edges:
        dependents.setdefault(depends_on_id, []).append(service_id)

    down_ids = set(down_service_ids)  # ids ya caidos (conjunto, sin duplicados)
    impacted: set = set()  # ids que van quedando afectados (conjunto, sin duplicados)
    queue = deque(down_ids)  # cola FIFO: arranca con los caidos, se recorre en orden de llegada
    operations = 0

    while queue:
        current = queue.popleft()  # saca el primero que entro (FIFO)
        operations += 1
        for dependent_id in dependents.get(current, []):  # array de quienes dependen de 'current'
            if dependent_id in down_ids or dependent_id in impacted:
                continue  # ya caido o ya marcado: no lo proceso de nuevo (evita loops si hay ciclos)
            impacted.add(dependent_id)
            queue.append(dependent_id)  # lo agrego al final de la cola para visitarlo despues
            operations += 1

    return ImpactAnalysis(
        impacted_service_ids=list(impacted),
        operations_count=operations,
    )
