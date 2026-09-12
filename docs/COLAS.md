# Colas en Sentinel

Sentinel usa dos colas, con propósitos distintos y en capas distintas del sistema:

1. **Cola de prioridad (min-heap)** — decide *a quién le toca* revisión cada minuto.
2. **Cola de trabajo (Celery + Redis)** — reparte el trabajo de *revisar* entre workers.

La primera decide el orden. La segunda ejecuta lo que la primera decidió. Trabajan juntas: la
cola de prioridad produce una lista de IDs, y esa lista se empuja a la cola de trabajo.

---

## 1. Cola de prioridad — el turnero de revisiones

### Dónde vive

`backend/application/use_cases/select_due_checks.py`
 
### Problema que resuelve

Cada servicio monitoreado tiene su propio intervalo (`check_interval_seconds`): uno puede
querer revisarse cada 60 segundos, otro cada 300. El reloj de fondo (Celery beat) dispara un
tick cada 60 segundos sin importar cuántos servicios haya ni qué intervalo tenga cada uno. Hace
falta una pieza que, en cada tick, decida cuáles de esos servicios ya vencieron su turno y
cuáles todavía no.

### Cómo funciona

Es un **min-heap** (`heapq` de la librería estándar de Python), ordenado por `due_at` — el
momento en que a cada servicio le toca la próxima revisión. La cima del heap siempre es el
servicio más atrasado.

```python
import heapq
from datetime import datetime, timedelta

def _due_at(last_checked_at, interval_seconds, now):
    if last_checked_at is None:
        return now  # nunca revisado: le toca ya
    return last_checked_at + timedelta(seconds=interval_seconds)

def select_due_checks(candidates, now, lookahead_seconds=0.0):
    horizon = now + timedelta(seconds=lookahead_seconds)
    heap = []
    operations = 0

    for service_id, last_checked_at, interval_seconds in candidates:
        heap.append((_due_at(last_checked_at, interval_seconds, now), service_id))
        operations += 1

    heapq.heapify(heap)          # O(n) — arma el heap de una
    total_scheduled = len(heap)

    due_service_ids = []
    while heap and heap[0][0] <= horizon:   # peek O(1)
        _, service_id = heapq.heappop(heap) # pop O(log n)
        due_service_ids.append(service_id)
        operations += 1

    return DueCheckSelection(due_service_ids, total_scheduled, operations)
```

`heap[0]` en un heap de Python siempre es el elemento más chico — acá, la fecha de vencimiento
más próxima. Mientras esa cima ya haya vencido (`<= horizon`), se saca (`heappop`) y se agrega a
la lista de vencidos. En cuanto la cima todavía no vence, se corta el `while`: el resto de la
cola queda intacta para el próximo tick.

`lookahead_seconds` es el margen que evita que un servicio de intervalo 60 se atrase esperando
la vuelta siguiente del reloj: si el beat corre cada 60s, se le pasa `lookahead_seconds=60`, así
se incluye todo lo que vencerá antes del próximo tick, no solo lo que ya venció en este instante
exacto.

### Costo

Meter los `n` servicios candidatos al heap cuesta `O(n)` (`heapify` es lineal, no
`n log n`). Sacar cada uno de los `k` vencidos cuesta `O(log n)`. Total: `O(n + k log n)`. Como
en un tick normal solo un puñado de servicios está vencido (`k` chico frente a `n`), esto es
bastante más barato que ordenar la lista completa (`O(n log n)`) en cada tick.

### De dónde salen los datos (candidatos)

`backend/infrastructure/repositories/service_repository.py:71`

```python
def get_scheduling_candidates(self) -> List[Tuple[int, Optional[datetime], int]]:
    # (service_id, ultimo checked_at, intervalo) por servicio activo.
    rows = (
        ServiceModel.objects.filter(is_active=True)
        .annotate(last_checked_at=Max('checks__checked_at'))
        .values_list('id', 'last_checked_at', 'check_interval_seconds')
    )
    return list(rows)
```

Una sola consulta a la base trae, para cada servicio activo, su ID, la fecha de su último check
(`Max` sobre la relación `checks`) y su intervalo configurado. Esa tupla es justo lo que
`select_due_checks` necesita como candidato.

### Quién la dispara y qué hace con el resultado

`backend/infrastructure/tasks/ping_tasks.py:46`

```python
SCHEDULER_TICK_SECONDS = 60.0

@app.task
def schedule_all_pings():
    repo = DjangoServiceRepository()
    selection = select_due_checks(
        repo.get_scheduling_candidates(),
        timezone.now(),
        lookahead_seconds=SCHEDULER_TICK_SECONDS,
    )
    for service_id in selection.due_service_ids:
        ping_service_task.delay(service_id)   # <- acá entra a la otra cola (Celery)

    logger.info(
        "Turnero: %d/%d servicios vencidos encolados (%d operaciones)",
        len(selection.due_service_ids), selection.total_scheduled, selection.operations_count,
    )
```

`schedule_all_pings` es la tarea que Celery beat dispara cada minuto (ver más abajo). Vacía la
cola de prioridad y, por cada servicio vencido, lo manda a la cola de trabajo con `.delay(...)`.
Esta es la tarea que en producción deja el log `Turnero: 2/2 servicios vencidos encolados (4
operaciones)`.

### Resultado tipado

`backend/domain/entities/scheduling.py`

```python
@dataclass
class DueCheckSelection:
    due_service_ids: List[int]
    total_scheduled: int
    operations_count: int
```

Estructura simple de solo datos, sin lógica — vive en `domain/` porque no depende de nada
externo (ni Django, ni Celery).

---

## 2. Cola de trabajo — Celery sobre Redis

### Dónde vive

`backend/infrastructure/tasks/ping_tasks.py` (las tareas) y
`backend/config/settings/base.py:72` (el reloj que las dispara).

### Qué problema resuelve

Revisar un servicio implica una llamada HTTP que puede tardar (timeouts, sitios lentos). Si eso
corriera dentro del mismo proceso que decide el turnero, un servicio colgado bloquearía a todos
los demás. La solución clásica: la decisión ("a quién revisar") se separa de la ejecución
("revisarlo"), y la ejecución se reparte entre varios *workers* que consumen de una cola
compartida.

### Cómo funciona

Celery usa Redis como *broker*: una cola FIFO de mensajes. Cuando el código hace
`ping_service_task.delay(service_id)`, no ejecuta la función ahí mismo — serializa el llamado y
lo empuja a la cola en Redis. Uno o más procesos *worker*, corriendo aparte (`celery -A config
worker`), están escuchando esa cola y sacan (consumen) tareas a medida que tienen capacidad
libre.

```python
@app.task(bind=True, max_retries=3)
def ping_service_task(self, service_id: int):
    repo = DjangoServiceRepository()
    notifier = _build_notifier()
    try:
        res = ping_service(service_id, repo, notifier)
        return {"service_id": service_id, "status": res.status.value, "response_time": res.response_time_ms}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)   # vuelve a encolarse si falla
```

Si `ping_service` lanza una excepción (por ejemplo, el sitio no responde), `self.retry` no
revienta la tarea: la vuelve a poner en la cola para reintentar en 30 segundos, hasta 3 veces
(`max_retries=3`).

### Quién dispara el tick cada minuto

`backend/config/settings/base.py:72`

```python
CELERY_BEAT_SCHEDULE = {
    'schedule-all-pings-every-minute': {
        'task': 'infrastructure.tasks.ping_tasks.schedule_all_pings',
        'schedule': 60.0,
    },
    'purge-trial-data-daily': {
        'task': 'infrastructure.tasks.ping_tasks.purge_trial_user_data',
        'schedule': 86400.0,
    },
}
```

Celery beat es un proceso aparte (`celery -A config beat`) cuyo único trabajo es poner tareas en
la cola según este horario — no ejecuta nada él mismo, solo dispara.

### Las dos colas en conjunto

```
cada 60s ---> beat dispara schedule_all_pings
                  |
                  v
        cola de prioridad (heap, en memoria, vive y muere dentro de la tarea)
                  |
                  v   .delay(service_id) por cada vencido
        cola de trabajo (Redis, persistente, consumida por N workers)
                  |
                  v
              ping_service_task  ->  revisa el sitio, guarda resultado, dispara alertas
```

La cola de prioridad es efímera: se arma y se vacía dentro de una sola ejecución de
`schedule_all_pings`, no persiste entre ticks. La cola de trabajo sí persiste en Redis: si un
worker está ocupado o caído, las tareas quedan esperando ahí hasta que alguien las consuma.

### Tests

`backend/tests/unit/test_select_due_checks.py` — cubre la cola de prioridad: servicio nunca
revisado siempre entra, solo entran los vencidos, salen en orden de prioridad, el margen de
lookahead respeta intervalos largos, lista vacía no rompe nada, y el conteo de operaciones se
mantiene bajo (verifica el costo `O(n + k log n)` descripto arriba).
