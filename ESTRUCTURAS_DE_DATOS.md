# Documentacion simple — funcionalidad de Topologia/Dependencias (turnero + mapa de servicios)

Explica en criollo que hizo el otro agente, archivo por archivo. Se actualiza a medida que agrega mas cosas. Ultima revision: se agrego el mapa visual de dependencias (frontend) y el endpoint que lo alimenta.

---

## Resumen de la funcionalidad completa

Se armaron DOS cosas relacionadas pero distintas:

1. **Turnero de revisiones**: decide que servicios revisar en cada corrida (cada 60s), en vez de revisar todos siempre.
2. **Mapa de dependencias / topologia**: el usuario puede decir "el Servicio A depende del Servicio B", y el sistema dibuja un grafico y avisa en cascada que se cae si algo se cae.

---

## BACKEND

### 1. `backend/application/use_cases/select_due_checks.py`
**Que hace:** elige que servicios "les toca revisar ya" en la corrida actual.
**Como:** arma una lista de `(hora_en_que_vence, id_del_servicio)` y la mete en una **cola de prioridad** (`heapq`, un min-heap): el que vence primero siempre queda arriba, sin ordenar toda la lista. Va sacando de arriba mientras venzan dentro del horizonte (60s).
**Estructuras:** `heap` es un **array (lista)** de **tuplas** de 2 datos. `due_service_ids` es un array de ids (numeros).
**No es archivo nuevo** (ya existia), pero es la base del turnero.

### 2. `backend/application/use_cases/compute_impacted_services.py` (NUEVO)
**Que hace:** dado quien depende de quien y quien esta caido, calcula quien se ve afectado en cadena.
**Como:** arranca desde los servicios caidos y "camina" hacia quienes dependen de ellos, nivel por nivel (esto se llama BFS — busqueda en anchura). Usa una **cola** (`collections.deque`, FIFO: el primero que entra es el primero en salir) para ir en orden, y un **set** (lista sin duplicados) para no revisar el mismo servicio dos veces aunque haya dependencias circulares.
**Estructuras:**
- `dependents: Dict[int, List[int]]` — diccionario: para cada id de servicio, un array con quienes dependen de el.
- `down_ids`, `impacted` — sets de ids (numeros).
- `queue = deque(...)` — la cola de verdad.
- Resultado (`ImpactAnalysis`): array `impacted_service_ids` con los ids afectados.
**Conectado a:** `ServiceViewSet.graph` en `service_views.py` (ver abajo). **Ya esta en uso real**, no es codigo suelto.

### 3. `backend/tests/unit/test_compute_impacted_services.py` (NUEVO)
**Que hace:** prueba automatica que verifica que el calculo de impacto funcione bien: sin dependencias, dependencia directa, dependencia en cadena, servicios ya caidos (no se cuentan como "impactados" a si mismos), ciclos (A depende de B y B de A, no debe colgarse), y servicios sin relacion (no se marcan). Corre con `pytest`.

### 4. `backend/domain/entities/scheduling.py` (MODIFICADO)
**Que hace:** define los "moldes" de datos del turnero (no logica, solo forma de los datos).
- `ScheduledCheck`: un servicio y cuando le toca revisarse.
- `DueCheckSelection`: resultado de una corrida del turnero (que ids vencieron, cuantos habia en total, cuantas operaciones hizo).
- `SchedulerRun`: cuando corrio el turnero por ultima vez.

### 5. `backend/domain/entities/service.py` (MODIFICADO)
**Agregado:** `ServiceDependency` (un servicio y de quien depende) y `ImpactAnalysis` (lista de ids afectados + cuantas operaciones tomo calcularlo). Son moldes de datos, sin logica.

### 6. `backend/domain/interfaces/scheduler_repository.py` (NUEVO)
**Que hace:** contrato (interfaz) que dice "cualquier repositorio de turnero debe poder guardar una corrida (`record_run`) y leer la ultima (`get_latest_run`)". No tiene implementacion, es solo la regla que debe cumplir infraestructura.

### 7. `backend/domain/interfaces/service_repository.py` (MODIFICADO)
**Agregado:** dos metodos nuevos al contrato de repositorio de servicios: `get_scheduling_candidates` (trae los datos que necesita el turnero) y `get_dependency_edges` (trae las dependencias de un usuario).

### 8. `backend/infrastructure/repositories/scheduler_repository.py` (NUEVO)
**Que hace:** implementacion real (con Django) del contrato de arriba. Guarda siempre en la misma fila de la tabla (`SINGLETON_ID = 1`), pisando el dato anterior cada corrida — no es cola ni pila, es "la ultima foto".

### 9. `backend/infrastructure/repositories/service_repository.py` (MODIFICADO)
**Agregado:**
- `get_scheduling_candidates`: trae de la base `(id_servicio, ultima_revision, intervalo)` de cada servicio activo. Alimenta el heap del turnero.
- `get_dependency_edges`: trae de la base las dependencias (`ServiceDependency`) de los servicios de un usuario.

### 10. `backend/infrastructure/models.py` (MODIFICADO)
**Agregado:**
- `ServiceDependencyModel`: tabla que guarda "servicio X depende de servicio Y" (no se puede repetir el mismo par).
- `SchedulerRunModel`: tabla de una sola fila que guarda el estado de la ultima corrida del turnero.

### 11. `backend/infrastructure/migrations/0008_schedulerrunmodel_servicedependencymodel.py` (NUEVO)
**Que hace:** la migracion de Django que crea esas dos tablas nuevas en la base de datos real. Es un archivo generado automaticamente, no se edita a mano.

### 12. `backend/infrastructure/tasks/ping_tasks.py` (MODIFICADO)
**Que hace:** la tarea `schedule_all_pings` (corre cada 60s via Celery Beat) ahora usa `select_due_checks` para saber a quien revisar, encola una tarea de ping por cada uno (`ping_service_task.delay(...)`, esto usa la cola real de Redis/Celery), y guarda el resultado de la corrida con `DjangoSchedulerRepository().record_run(...)`.

### 13. `backend/interfaces/http/serializers/service_serializer.py` (MODIFICADO)
**Agregado:** `ServiceDependencySerializer` — valida que al crear una dependencia: (a) un servicio no dependa de si mismo, (b) ambos servicios sean del mismo usuario que hace el pedido. Si no cumple, devuelve error `invalid_dependency`.

### 14. `backend/interfaces/http/views/service_views.py` (MODIFICADO)
**Agregado:**
- Accion `graph` (`GET /api/v1/services/graph/`): junta todos los servicios del usuario, sus dependencias, calcula quien esta caido y llama a `compute_impacted_services` para saber quien se ve afectado en cadena. Devuelve `{ nodes: [...], edges: [...] }` listo para dibujar.
- `ServiceDependencyViewSet`: CRUD (crear/leer/borrar, sin editar) de dependencias entre servicios, filtrado por dueno.

### 15. `backend/interfaces/http/views/scheduler_views.py` (NUEVO)
**Que hace:** endpoint `GET /api/v1/scheduler/status/`, solo para superusuarios. Devuelve cuando corrio el turnero por ultima vez, hace cuantos segundos, y cuantos servicios encolo vs cuantos habia en total. Sirve para saber si el reloj de fondo sigue vivo.

### 16. `backend/interfaces/http/urls.py` (MODIFICADO)
**Agregado:** registra `ServiceDependencyViewSet` en el router (`/api/v1/service-dependencies/`) y la ruta `scheduler/status/`.

---

## FRONTEND

### 17. `frontend/src/application/hooks/useServiceGraph.js` (NUEVO)
**Que hace:** hook de React que trae del backend (`GET /services/graph/`) la lista de servicios (`nodes`) y dependencias (`edges`), y expone funciones para agregar (`addDependency`) o quitar (`removeDependency`) una dependencia via API.
**Estructuras:** `nodes` y `edges` son arrays de objetos (cada uno con sus datos: id, nombre, estado, etc).

### 18. `frontend/src/application/hooks/useSchedulerStatus.js` (NUEVO)
**Que hace:** hook que consulta `GET /scheduler/status/` cada 30 segundos (con `setInterval`) para mostrar en vivo si el turnero sigue corriendo.

### 19. `frontend/src/presentation/components/TopologyGraph.jsx` (NUEVO)
**Que hace:** dibuja el grafico SVG del mapa de dependencias. Pone cada servicio como un circulo en forma de rueda (posiciones circulares calculadas con seno/coseno), pinta flechas entre los que dependen uno del otro, y colorea cada circulo segun estado: gris (inactivo), rojo (caido), amarillo (impactado por otro caido), verde (funcionando). Permite click para borrar una dependencia.
**Estructuras:** recorre los arrays `nodes` y `edges` que le pasan por props; arma un objeto `positions` (diccionario: id de servicio a coordenadas x/y).

### 20. `frontend/src/presentation/components/NextCheckCountdown.jsx` (NUEVO)
**Que hace:** muestra una cuenta regresiva ("30s", "2m 15s") de cuanto falta para la proxima revision de un servicio, actualizandose cada segundo.

### 21. `frontend/src/presentation/components/SchedulerHealthCard.jsx` (NUEVO)
**Que hace:** tarjeta que muestra si el turnero esta "sano" (corrio hace menos de 90 segundos) o no, y cuantos servicios encolo en la ultima corrida vs el total.

### 22. `frontend/src/presentation/pages/TopologyPage.jsx` (NUEVO)
**Que hace:** la pagina completa de "Topologia de Servicios". Tiene un formulario para elegir dos servicios y decir "este depende de aquel", y debajo muestra el `TopologyGraph`. Usa el hook `useServiceGraph`.

### 23-27. `App.jsx`, `Sidebar.jsx`, `ServiceCard.jsx`, `AdminUsersPage.jsx`, `i18n.js` (MODIFICADOS, cambios chicos)
**Que hacen:** cablean lo de arriba a la app: agregan la ruta/link a la nueva pagina de Topologia en el menu lateral, textos de traduccion, y pequenos ajustes en la tarjeta de servicio. Cambios de 2 a 6 lineas cada uno, sin logica nueva relevante.

---

## Tabla resumen — colas, pilas y estructuras de busqueda

| Estructura | Tipo | Archivo | Para que |
|---|---|---|---|
| `heap` (min-heap) | Cola de prioridad | `backend/application/use_cases/select_due_checks.py` | Elegir que servicios revisar ya |
| `deque` | Cola (FIFO) | `backend/application/use_cases/compute_impacted_services.py` | BFS: recorrer en cadena quien se ve afectado si algo se cae |
| Redis + Celery | Cola de tareas | `backend/infrastructure/tasks/ping_tasks.py` | Ejecutar revisiones en segundo plano sin trabar la API |
| `nodes` / `edges` (arrays de objetos) | Grafo (nodos + aristas) | `backend/interfaces/http/views/service_views.py` (accion `graph`, linea 104) → consumido por `frontend/src/application/hooks/useServiceGraph.js` → pintado en `frontend/src/presentation/components/TopologyGraph.jsx` | Representar servicios (nodos) y sus dependencias (aristas/flechas) para dibujar el mapa de topologia |
| `stackRef.current` (array usado como pila) | Pila (LIFO) | `frontend/src/application/hooks/useFilterStack.js` — usada desde `frontend/src/application/hooks/useHistory.js` (funcion `undoFilter`) en `frontend/src/presentation/pages/HistoryPage.jsx` | Boton "deshacer" del historial: apila (`push`) cada estado de filtro antes de cambiarlo, y al deshacer saca (`pop`) el ultimo guardado. Ultimo que entra, primero que sale |

**Donde esta cada pieza del grafo:**
- **Calculo** (quien se ve afectado): `backend/application/use_cases/compute_impacted_services.py` — usa la cola `deque`, no la pila.
- **Armado del grafo para mostrar** (nodos + aristas ya con colores/estado): `backend/interfaces/http/views/service_views.py:104-133`, accion `graph`.
- **Traido al frontend:** `frontend/src/application/hooks/useServiceGraph.js` (arrays `nodes`/`edges`).
- **Dibujado:** `frontend/src/presentation/components/TopologyGraph.jsx` (posiciones circulares + colores segun `impacted`/`status`).
- **Pagina que junta todo:** `frontend/src/presentation/pages/TopologyPage.jsx`.

**Donde esta la pila del undo:**
- **La pila en si** (push/pop O(1), tope de 20 niveles): `frontend/src/application/hooks/useFilterStack.js`.
- **Quien la usa:** `frontend/src/application/hooks/useHistory.js` — `setFilters` hace `filterStack.push(filters)` antes de cambiar; `undoFilter` hace `filterStack.pop()` para volver atras.
- **Boton que lo dispara:** pagina `frontend/src/presentation/pages/HistoryPage.jsx`, via `canUndo` y `undoFilter` que devuelve `useHistory`.

**Endpoint que conecta el grafo:** `GET /api/v1/services/graph/` en `backend/interfaces/http/views/service_views.py` (accion `graph`) — junta heap, deque/BFS y las tablas nuevas, y se lo sirve al frontend (`useServiceGraph.js` a `TopologyGraph.jsx`).
