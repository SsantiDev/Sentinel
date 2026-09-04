# Los 4 algoritmos, línea por línea (código real del servidor)

Este documento es el equivalente de `docs/FRONTEND_LINEA_POR_LINEA.md` pero del lado del
servidor: sigue el código real, línea por línea, de los **4 cálculos** que Sentinel aplica
sobre el historial de un servicio, más las piezas que los conectan (la entrada HTTP y el
acceso a la base de datos).

No repite las analogías de `docs/COMO_FUNCIONAN_LOS_ALGORITMOS.md` (ese documento explica
**para qué sirve** cada cálculo, en lenguaje corriente). Este se queda en **cómo está
escrito**: qué hace cada línea y a qué función salta después. Tampoco explica conceptos de
React — ese lado ya está en el documento del frontend.

Los 4 algoritmos:

1. **Estadísticas + búsqueda binaria por hora** — `calculate_service_stats.py`
2. **Inicio de una caída, por bisección** — `find_incident_start.py`
3. **Medalla de confiabilidad, por progresión aritmética** — `calculate_reliability_tier.py`
4. **Tendencia de latencia, por regresión lineal** — `predict_latency_trend.py`

---

## Índice

- [Parte 0 — Mapa de una sola mirada](#parte-0)
- [Parte 1 — La entrada: `service_views.py`](#parte-1)
- [Parte 2 — La pieza compartida: traer las revisiones ordenadas](#parte-2)
- [Parte 3 — Algoritmo 1: `calculate_service_stats.py`](#parte-3)
- [Parte 4 — Algoritmo 2: `find_incident_start.py`](#parte-4)
- [Parte 5 — Algoritmo 3: `calculate_reliability_tier.py`](#parte-5)
- [Parte 6 — Algoritmo 4: `predict_latency_trend.py`](#parte-6)
- [Parte 7 — Las formas de los resultados: `domain/entities/`](#parte-7)
- [Parte 8 — El recorrido completo, en orden, para los 3 endpoints](#parte-8)
- [Apéndice — Glosario técnico](#apendice)

---

<a name="parte-0"></a>

## Parte 0 — Mapa de una sola mirada

Los tres pedidos que dispara `useServiceAnalytics.js` (frontend) llegan acá:

```
GET /api/v1/services/42/stats/
GET /api/v1/services/42/incidents/
GET /api/v1/services/42/trend/
        │
        ▼
service_views.py — ServiceViewSet          (capa interfaces: recibe HTTP, arma JSON)
        │  cada action llama a un caso de uso, pasándole un repositorio
        ▼
service_repository.py — DjangoServiceRepository   (capa infrastructure: habla con Postgres)
        │  entrega la lista de revisiones ordenada ASCENDENTE por fecha
        ▼
   ┌────────────────────────┬──────────────────────┬──────────────────────────┐
   ▼                        ▼                       ▼                          
calculate_service_stats  find_incident_start   predict_latency_trend      
  (Algoritmo 1)             (Algoritmo 2)          (Algoritmo 4)          
   │                                                                       
   └──► calculate_reliability_tier (Algoritmo 3)                           
```

Los cuatro archivos de algoritmos viven en `backend/application/use_cases/` (capa
*application*): son funciones puras — reciben datos, devuelven datos, no tocan Django ni
HTTP directamente. Por eso el mismo cálculo se puede probar con datos de prueba sin levantar
un servidor (ver `backend/tests/`).

---

<a name="parte-1"></a>

## Parte 1 — La entrada: `backend/interfaces/http/views/service_views.py`

Acá aterrizan los tres pedidos HTTP y de acá salen las tres respuestas JSON.

### 1.1 Imports y arranque de la clase (líneas 1 a 27)

```python
 1  from dataclasses import asdict
 2  from datetime import datetime
 3
 4  from rest_framework import viewsets, status
 5  from rest_framework.decorators import action
 6  from rest_framework.pagination import PageNumberPagination
 7  from rest_framework.response import Response
 8  from infrastructure.models import ServiceModel, CheckResultModel, AlertRuleModel
 9  from infrastructure.repositories.service_repository import DjangoServiceRepository
10  from interfaces.http.serializers.service_serializer import ServiceSerializer, CheckResultSerializer, AlertRuleSerializer
11  from infrastructure.tasks.ping_tasks import ping_service_task
12  from application.use_cases.calculate_service_stats import calculate_service_stats, find_check_by_timestamp_binary
13  from application.use_cases.find_incident_start import find_incident_start
14  from application.use_cases.predict_latency_trend import predict_latency_trend
```

- **L1** — `asdict`: función de la librería estándar de Python que convierte un `dataclass`
  (una clase que solo guarda campos, ver Parte 7) en un diccionario común, listo para
  convertir a JSON.
- **L4-7** — piezas de Django REST Framework (DRF): `viewsets` (la base de las clases que
  exponen un modelo como API), `action` (para agregar una dirección "extra" además del
  CRUD estándar — así se definen `/stats/`, `/incidents/`, `/trend/`, `/ping/`,
  `/history/`), `Response` (empaqueta un dato de Python como respuesta HTTP con su JSON).
- **L9** — trae la implementación concreta del repositorio
  (`DjangoServiceRepository`, capa *infrastructure*). **→ Parte 2.**
- **L11** — la tarea de Celery que hace el ping real en segundo plano (la usa la acción
  `ping`, L43; no es uno de los 4 algoritmos, se menciona solo para ubicar el flujo).
- **L12** — trae **Algoritmo 1** y su búsqueda binaria. **→ Parte 3.**
- **L13** — trae **Algoritmo 2**. **→ Parte 4.**
- **L14** — trae **Algoritmo 4**. **→ Parte 6.** (Algoritmo 3 no se importa acá porque
  nadie lo llama directo desde la vista: lo usa Algoritmo 1 por dentro, ver Parte 3.)

```python
23  class ServiceViewSet(viewsets.ModelViewSet):
24      serializer_class = ServiceSerializer
25
26      def get_queryset(self):
27          return ServiceModel.objects.prefetch_related('checks').filter(owner=self.request.user)
```

- **L23** — la clase que agrupa todas las direcciones relacionadas a "un servicio":
  crear, listar, editar, borrar (heredado de `ModelViewSet`) más las cuatro `action`
  personalizadas de abajo.
- **L26-27** — **`get_queryset` es el filtro de seguridad de toda la clase.** Cualquier
  acción que use `self.get_object()` (ver L53, L72, L87) termina consultando esta lista, que
  ya viene filtrada por `owner=self.request.user`: un usuario **nunca** puede pedir
  estadísticas, incidentes ni tendencia de un servicio que no es suyo, aunque adivine el
  número de otro. `prefetch_related('checks')` es una optimización de Django (trae las
  revisiones relacionadas en la misma tanda de consultas, no una por una).

### 1.2 `stats` — Algoritmo 1 (líneas 51 a 68)

```python
51      @action(detail=True, methods=['get'])
52      def stats(self, request, pk=None):
53          service = self.get_object()
54          repo = DjangoServiceRepository()
55          result = calculate_service_stats(service.id, repo)
56          data = asdict(result)
57
58          at_param = request.query_params.get('at')
59          if at_param:
60              checks = repo.get_checks_for_service(service.id, limit=500)
61              nearest, operations = find_check_by_timestamp_binary(checks, datetime.fromisoformat(at_param))
62              data['nearest_check'] = {
63                  'checked_at': nearest.checked_at.isoformat() if nearest else None,
64                  'status': nearest.status.value if nearest else None,
65                  'search_operations': operations,
66              }
67
68          return Response(data)
```

- **L51** — `@action(detail=True, methods=['get'])`: registra esta función como una
  dirección extra, solo para `GET`, que cuelga de un servicio puntual (`detail=True`). Junto
  con el nombre del método (`stats`), DRF arma la dirección
  `GET /api/v1/services/<id>/stats/`.
- **L53** — `self.get_object()`: busca el servicio con el `pk` de la dirección **dentro del
  `get_queryset` de la L27**. Si no existe, o existe pero es de otro usuario, corta acá con
  un 404 — nunca llega a ejecutarse el resto de la función.
- **L54** — crea una instancia del repositorio concreto (Postgres).
- **L55** — **→ Algoritmo 1: `calculate_service_stats.py:17`**, pasándole el id del
  servicio y el repositorio. Con eso alcanza para que el algoritmo traiga sus propias
  revisiones (Parte 2) y calcule todo.
- **L56** — `asdict(result)`: el `ServiceStats` que devolvió el algoritmo (un objeto
  Python) se convierte en un diccionario plano (`{'service_id': 42, 'uptime_percentage':
  98.5, ...}`), el formato que DRF sabe convertir a JSON.
- **L58** — lee el parámetro opcional de la dirección `?at=2026-09-03T14:32:00`, si vino.
- **L59-66** — solo si vino ese parámetro:
  - **L60** — pide **de nuevo** las revisiones (esta vez directo, sin pasar por el
    algoritmo 1) — hasta 500, en el mismo orden ascendente.
  - **L61** — **→ la búsqueda binaria de `calculate_service_stats.py:46`**, con la fecha
    ya convertida de texto a objeto `datetime` (`datetime.fromisoformat`).
  - **L62-66** — arma un sub-diccionario `nearest_check` con la fecha, el estado y cuántas
    operaciones usó la búsqueda (esto último es solo para poder demostrarlo en pruebas).
- **L68** — `Response(data)`: DRF serializa `data` a JSON y responde `200 OK`.
  **→ esto es exactamente lo que en el frontend llega a `useServiceAnalytics.js:19` como
  `statsRes.data`.**

### 1.3 `incidents` — Algoritmo 2 (líneas 70 a 83)

```python
70      @action(detail=True, methods=['get'])
71      def incidents(self, request, pk=None):
72          service = self.get_object()
73          repo = DjangoServiceRepository()
74          incident = find_incident_start(service.id, repo)
75          if not incident:
76              return Response({'active_incident': False})
77
78          return Response({
79              'active_incident': True,
80              'started_at': incident.start_check.checked_at.isoformat(),
81              'is_ongoing': incident.is_ongoing,
82              'search_operations': incident.operations_count,
83          })
```

- **L71** — dirección: `GET /api/v1/services/<id>/incidents/`.
- **L72-73** — mismas dos líneas de siempre: objeto del servicio (con su chequeo de
  dueño) y repositorio.
- **L74** — **→ Algoritmo 2: `find_incident_start.py:22`**.
- **L75-76** — si el algoritmo devuelve `None` (no hay caída activa ahora mismo), responde
  un objeto chico con `active_incident: False` y corta. **→ esto es lo que hace que
  `IncidentBanner.jsx:14` no dibuje nada.**
- **L78-83** — si hay incidente, arma la respuesta leyendo los campos del objeto
  `IncidentPeriod` que devolvió el algoritmo (Parte 7): la hora de inicio
  (`incident.start_check.checked_at`, convertida a texto con `.isoformat()`), si sigue en
  curso, y cuántos pasos de bisección hicieron falta.

### 1.4 `trend` — Algoritmo 4 (líneas 85 a 99)

```python
85      @action(detail=True, methods=['get'])
86      def trend(self, request, pk=None):
87          service = self.get_object()
88          repo = DjangoServiceRepository()
89          critical_ms = float(request.query_params.get('critical_ms', 2000))
90          trend = predict_latency_trend(service.id, repo, critical_threshold_ms=critical_ms)
91          if not trend:
92              return Response({'has_data': False})
93
94          return Response({
95              'has_data': True,
96              'slope_ms_per_check': trend.slope_ms_per_check,
97              'is_degrading': trend.is_degrading,
98              'predicted_checks_to_breach': trend.predicted_checks_to_breach,
99          })
```

- **L86** — dirección: `GET /api/v1/services/<id>/trend/`.
- **L89** — lee el parámetro opcional `?critical_ms=...` (el límite de lentitud, en
  milisegundos, que el usuario considera inaceptable); si no vino, usa `2000` por defecto.
  `float(...)` fuerza a número — si alguien manda texto no numérico, esta línea revienta con
  un error 500 (no hay validación adicional acá).
- **L90** — **→ Algoritmo 4: `predict_latency_trend.py:20`**, con el id, el repo y ese
  límite.
- **L91-92** — si el algoritmo devuelve `None` (menos de 2 revisiones con latencia
  medible), responde `{'has_data': False}`. **→ hace que `TrendIndicator.jsx:6` no
  dibuje nada.**
- **L94-99** — si hay datos, arma la respuesta leyendo los campos del `LatencyTrend`
  (Parte 7): la pendiente, si está empeorando, y la predicción de en cuántas revisiones
  cruzaría el límite.

### 1.5 Lo que queda afuera de este documento

La misma clase también define `ping` (L41-44, dispara la tarea de Celery que hace el
chequeo real) y `history` (L46-49, trae las últimas 50 revisiones tal cual, sin
calcular nada). No son parte de los 4 algoritmos y no se detallan acá; el archivo
`docs/FRONTEND_LINEA_POR_LINEA.md` (Parte 4) explica cómo el frontend los usa.

---

<a name="parte-2"></a>

## Parte 2 — La pieza compartida: `backend/infrastructure/repositories/service_repository.py`

Los cuatro algoritmos **no saben nada de Django ni de SQL**. Reciben una lista de objetos
`CheckResult` (Parte 7) ya armada. Quien arma esa lista es esta función.

```python
60      def get_checks_for_service(self, service_id: int, limit: Optional[int] = None) -> List[CheckResult]:
61          # Orden ascendente por checked_at: lo requieren busqueda binaria, biseccion y regresion.
62          if limit:
63              recent = CheckResultModel.objects.filter(service_id=service_id).order_by('-checked_at')[:limit]
64              models = list(reversed(recent))
65          else:
66              models = list(CheckResultModel.objects.filter(service_id=service_id).order_by('checked_at'))
67          return [self._to_check_result_entity(m) for m in models]
```

- **L60** — recibe el id del servicio y, opcionalmente, un límite de cuántas revisiones
  traer como máximo. La llaman los cuatro algoritmos, cada uno con su propio límite:
  Algoritmo 1 pide hasta 500 (`calculate_service_stats.py:23`), Algoritmo 2 hasta 200
  (`find_incident_start.py:23`), Algoritmo 4 hasta 50 (`predict_latency_trend.py:24`).
- **L61** — el comentario deja explícito **por qué el orden importa**: los tres algoritmos
  que recorren la lista por posición (búsqueda binaria, bisección, regresión) darían
  resultados incorrectos si la lista viniera en cualquier otro orden.
- **L62-64** — **el truco para traer "las últimas N, pero en orden ascendente":**
  - **L63** — pide a la base de datos las revisiones ordenadas **descendente** (`-checked_at`,
    la más nueva primero) y corta las primeras `limit`. Esto es barato para la base de
    datos: usa el índice de fecha y no tiene que leer toda la tabla.
  - **L64** — `list(reversed(recent))` da vuelta esa lista en Python, quedando ahora
    ascendente (la más vieja primero). Se hace así, y no pidiendo directamente
    "ascendente, las últimas N", porque en SQL no hay una forma directa y eficiente de decir
    "dame los últimos N de una tabla ordenada ascendente" sin traer de más.
- **L65-66** — si no se pidió límite (nadie de los cuatro algoritmos hace esto, pero la
  interfaz lo permite — ver Parte 7), trae **todas** las revisiones, directamente en orden
  ascendente.
- **L67** — convierte cada fila de la base de datos (`CheckResultModel`, un modelo de
  Django) al objeto del dominio (`CheckResult`, un `dataclass` plano — Parte 7) con
  `_to_check_result_entity` (línea 79 del mismo archivo). Este paso es la frontera: para
  adentro de los algoritmos, todo es un `CheckResult` común; nadie de la capa *application*
  llega a ver un modelo de Django.

```python
79      def _to_check_result_entity(self, m: CheckResultModel) -> CheckResult:
80          return CheckResult(
81              id=m.pk,
82              service_id=m.service_id,
83              status=ServiceStatus(m.status),
84              response_time_ms=m.response_time_ms,
85              status_code=m.status_code,
86              error_message=m.error_message,
87              checked_at=m.checked_at,
88          )
```

- **L83** — `ServiceStatus(m.status)`: el modelo de Django guarda el estado como texto
  simple (`'up'`, `'down'`); acá se lo envuelve en el `enum` `ServiceStatus` (Parte 7), así
  el resto del código compara contra `ServiceStatus.UP` en vez de contra el texto literal
  `'up'`.

**Por qué esto importa para el diseño:** `service_repository.py` es la única pieza que
sabe hablar con Postgres. La interfaz que promete implementar,
`domain/interfaces/service_repository.py` (`IServiceRepository`), es una clase abstracta
que declara `get_checks_for_service(...)` sin decir cómo. Los cuatro algoritmos reciben ese
tipo abstracto como parámetro (`repo: IServiceRepository`) — nunca el tipo concreto de
Django. Es la misma razón por la que se le puede pasar, en las pruebas, un repositorio de
mentira con datos fijos, sin tocar la base de datos real.

---

<a name="parte-3"></a>

## Parte 3 — Algoritmo 1: `backend/application/use_cases/calculate_service_stats.py`

Este archivo tiene **tres funciones**: el cálculo principal, un percentil, y dos formas de
buscar una revisión por hora (una rápida, una de referencia para comparar).

### 3.1 `_percentile` (líneas 10 a 14)

```python
10  def _percentile(sorted_values: List[float], pct: float) -> float:
11      if not sorted_values:
12          return 0.0
13      index = min(len(sorted_values) - 1, int(len(sorted_values) * pct))
14      return sorted_values[index]
```

- **L10** — recibe una lista **ya ordenada de menor a mayor** y una fracción (`0.95` para
  el p95). No ordena nada acá adentro: es responsabilidad de quien la llama (L30-32 más
  abajo) entregarla ordenada.
- **L11-12** — lista vacía (todavía no hay latencias medidas) → devuelve `0.0` en vez de
  romper.
- **L13** — `int(len(sorted_values) * pct)`: con 100 valores y `pct = 0.95`, da `95`. Ese es
  el índice (contando desde 0) del valor que queda en el puesto 96 de 100 — "el 95 % de los
  valores es igual o menor que este". El `min(len - 1, ...)` es un tope de seguridad: si
  `pct` fuera `1.0` exacto, la cuenta daría exactamente `len`, un índice que no existe (la
  lista llega hasta `len - 1`); el `min` lo recorta al último índice válido.
- **L14** — devuelve el valor que está sentado en esa posición de la lista ordenada.

### 3.2 `calculate_service_stats` (líneas 17 a 43)

```python
17  def calculate_service_stats(
18      service_id: int,
19      repo: IServiceRepository,
20      tier_a1: float = 80.0,
21      tier_d: float = 5.0,
22      tier_n: int = 4,
23      window: int = 500,
24  ) -> ServiceStats:
25      checks = repo.get_checks_for_service(service_id, limit=window)
26      total = len(checks)
27      up_count = sum(1 for c in checks if c.status == ServiceStatus.UP)
28      uptime_pct = (up_count / total * 100) if total else 0.0
29
30      latencies = sorted(c.response_time_ms for c in checks if c.response_time_ms is not None)
31      avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else None
32      p95_latency = round(_percentile(latencies, 0.95), 2) if latencies else None
33
34      tier = calculate_reliability_tier(uptime_pct, tier_a1, tier_d, tier_n)
35
36      return ServiceStats(
37          service_id=service_id,
38          uptime_percentage=round(uptime_pct, 2),
39          average_latency_ms=avg_latency,
40          p95_latency_ms=p95_latency,
41          total_checks=total,
42          reliability_tier=tier,
43      )
```

- **L17-24** — firma de la función, con **valores por defecto**: los umbrales de medalla
  arrancan en 80, suben de a 5, hay 4 medallas, y la ventana de revisiones a mirar es 500.
  `service_views.py:55` la llama sin pisar ninguno de estos cuatro, así que en producción
  siempre corre con estos valores.
- **L25** — **→ Parte 2**: trae hasta 500 revisiones, ascendente por fecha.
- **L26** — cuántas revisiones hay en total.
- **L27** — `sum(1 for c in checks if c.status == ServiceStatus.UP)`: una expresión
  generadora — recorre la lista una vez, "produce" un `1` por cada revisión cuyo estado es
  `UP` y los suma todos. El resultado neto es "cuántas están arriba", pero sin construir
  una lista intermedia en memoria (a diferencia de un `[... for ...]`, esto no guarda nada,
  solo va sumando sobre la marcha).
- **L28** — porcentaje de disponibilidad. `if total else 0.0` evita dividir por cero cuando
  el servicio todavía no tiene ninguna revisión.
- **L30** — `sorted(c.response_time_ms for c in checks if c.response_time_ms is not None)`:
  primero filtra (descarta revisiones sin tiempo de respuesta medido — por ejemplo, una que
  dio timeout puede no tener latencia), y **ordena** el resultado de menor a mayor. Esta es
  la lista que necesitan tanto el promedio como `_percentile`.
- **L31** — promedio = suma sobre cantidad, redondeado a 2 decimales; `None` si no hay
  ninguna latencia medida (en vez de un promedio de una lista vacía, que rompería).
- **L32** — **→ llama a `_percentile` (L10)** con esa lista ordenada y `0.95`; redondea a 2
  decimales. `None` en el mismo caso que el promedio.
- **L34** — **→ Algoritmo 3: `calculate_reliability_tier.py:4`**, con el porcentaje recién
  calculado y los cuatro parámetros de la firma. Así Algoritmo 1 obtiene la medalla sin
  reimplementar esa lógica.
- **L36-43** — arma el objeto `ServiceStats` (Parte 7) con todo lo calculado. Este es el
  objeto que `service_views.py:56` convierte con `asdict(...)`.

### 3.3 `find_check_by_timestamp_binary` (líneas 46 a 64) — la búsqueda rápida

```python
46  def find_check_by_timestamp_binary(
47      checks: List[CheckResult], target: datetime
48  ) -> Tuple[Optional[CheckResult], int]:
49      """Busca el check mas cercano a target sobre lista ordenada ascendente por checked_at.
50      O(log n) — mejor caso O(1) (match en el primer mid), peor caso O(log n)."""
51      lo, hi = 0, len(checks) - 1
52      operations = 0
53      best = None
54      while lo <= hi:
55          operations += 1
56          mid = (lo + hi) // 2
57          best = checks[mid]
58          if checks[mid].checked_at == target:
59              return checks[mid], operations
60          if checks[mid].checked_at < target:
61              lo = mid + 1
62          else:
63              hi = mid - 1
64      return best, operations
```

- **L46-48** — recibe la lista ascendente completa y la fecha buscada; devuelve una
  **tupla** de dos valores: la revisión más cercana encontrada (o `None` si la lista está
  vacía) y cuántas vueltas del bucle hicieron falta (ese segundo número es solo para poder
  demostrar, en las pruebas, que hace falta mucho menos trabajo que revisar una por una).
- **L51** — `lo` y `hi` marcan los bordes de la porción de la lista que todavía puede
  contener la respuesta. Arrancan cubriendo la lista entera.
- **L52** — contador de vueltas.
- **L53** — `best` va a ir guardando la revisión del medio en cada vuelta; si nunca hay una
  coincidencia exacta, al salir del bucle queda con la última que se miró (la más cercana
  posible).
- **L54** — mientras el borde izquierdo no cruce al derecho, sigue habiendo dónde buscar.
- **L56** — `mid`: la posición del medio de la porción actual (`(lo + hi) // 2`, división
  entera).
- **L57** — guarda la revisión del medio como mejor candidata hasta ahora.
- **L58-59** — si la fecha de esa revisión coincide **exactamente** con la buscada,
  termina ahí mismo: devuelve esa revisión y cuántas vueltas costó.
- **L60-61** — si la revisión del medio es **anterior** a la fecha buscada, la respuesta
  (si existe) está más adelante en la lista → se descarta toda la mitad de atrás moviendo
  `lo` justo después de `mid`.
- **L62-63** — si es **posterior**, la respuesta está más atrás → se descarta la mitad de
  adelante moviendo `hi` justo antes de `mid`.
- **L64** — el bucle terminó sin encontrar una coincidencia exacta (la fecha pedida no
  está en la lista) → devuelve la más cercana que se haya visto (`best`) y el conteo.

Cada vuelta del bucle descarta **la mitad** de lo que quedaba por mirar. Por eso con miles
de revisiones el número de vueltas se mantiene chico (con 1000 elementos, como mucho unas
10 vueltas en vez de 1000).

### 3.4 `find_check_by_timestamp_linear` (líneas 67 a 81) — la referencia lenta

```python
67  def find_check_by_timestamp_linear(
68      checks: List[CheckResult], target: datetime
69  ) -> Tuple[Optional[CheckResult], int]:
70      """Referencia O(n) para benchmark comparativo contra la version binaria.
71      Mejor caso O(1) (primer elemento es el mas cercano), peor caso O(n)."""
72      best = None
73      best_diff = None
74      operations = 0
75      for check in checks:
76          operations += 1
77          diff = abs((check.checked_at - target).total_seconds())
78          if best_diff is None or diff < best_diff:
79              best_diff = diff
80              best = check
81      return best, operations
```

- **L70-71** — el propio docstring lo dice: existe **solo** para poder comparar contra la
  binaria en pruebas/benchmarks (ver `docs/PRUEBA_ALGORITMOS.md`). Nadie en el flujo real
  de la aplicación la llama — `service_views.py:61` usa la binaria, no esta.
- **L75** — recorre **todas** las revisiones, una por una, sin poder saltarse ninguna
  (porque acá la lista no se aprovecha estando ordenada: se calcula la distancia a cada
  elemento y se compara).
- **L77** — `diff`: cuántos segundos de diferencia (en valor absoluto, con `abs(...)`) hay
  entre esa revisión y la fecha buscada.
- **L78-80** — si es la primera vuelta (`best_diff is None`) o esta diferencia es menor que
  la mejor hasta ahora, la reemplaza.
- **L81** — al terminar de recorrer toda la lista, devuelve la más cercana encontrada y
  cuántas vueltas costó (siempre el total de revisiones, a diferencia de la binaria).

---

<a name="parte-4"></a>

## Parte 4 — Algoritmo 2: `backend/application/use_cases/find_incident_start.py`

```python
 8  def _bisect_incident_start(checks: List[CheckResult], lo: int, hi: int, ops: List[int]) -> int:
 9      """Biseccion recursiva: encuentra el primer indice DOWN de una racha continua
10      que termina en hi. Precondicion: checks[hi] esta DOWN y la caida es continua
11      hasta hi (sin altibajos intermedios) — valido para detectar el inicio del
12      incidente activo actual. O(log n), peor caso profundidad log2(n)."""
13      ops[0] += 1
14      if lo == hi:
15          return lo
16      mid = (lo + hi) // 2
17      if checks[mid].status == ServiceStatus.DOWN:
18          return _bisect_incident_start(checks, lo, mid, ops)
19      return _bisect_incident_start(checks, mid + 1, hi, ops)
```

- **L8** — función **recursiva**: se llama a sí misma (L18 y L19) con una porción más chica
  de la lista, hasta encontrar la respuesta. Parámetros: la lista completa, los bordes
  `lo`/`hi` de la porción actual, y `ops` — un contador de pasos.
- **L9-12** — el docstring documenta la **precondición**: esta función asume que la racha
  de caídas es continua hasta el final de la ventana (no hay un "up" suelto en medio de la
  caída). Es una suposición válida en este uso puntual porque `find_incident_start` (más
  abajo) solo entra acá cuando la revisión más reciente está caída — es decir, se está
  buscando el inicio de la caída **que está pasando ahora mismo**, no una del pasado.
- **L13** — `ops[0] += 1`: suma uno al contador **cada vez que la función se ejecuta**
  (en cualquier nivel de la recursión). `ops` es una lista de un solo elemento en lugar de
  un número suelto **a propósito**: Python no deja que una llamada recursiva modifique
  directamente una variable numérica del nivel de arriba, pero sí puede modificar el
  contenido de una lista compartida — así todas las llamadas anidadas van sumando al mismo
  contador.
- **L14-15** — **caso base de la recursión**: cuando la porción se achicó a un solo índice
  (`lo == hi`), no hay más para dividir — ese es el índice del inicio de la caída. Sin este
  freno, la función se seguiría llamando a sí misma para siempre.
- **L16** — punto medio de la porción actual.
- **L17-18** — si la revisión del medio **ya está caída**, entonces el inicio de la racha
  está en algún punto entre `lo` y `mid` (inclusive) → se repite el proceso sobre esa mitad
  izquierda, más chica.
- **L19** — si la revisión del medio **todavía funcionaba**, el inicio de la racha está
  después de `mid` → se repite sobre la mitad derecha (`mid + 1` hasta `hi`).

```python
22  def find_incident_start(
23      service_id: int, repo: IServiceRepository, window: int = 200
24  ) -> Optional[IncidentPeriod]:
25      checks = repo.get_checks_for_service(service_id, limit=window)
26      if not checks or checks[-1].status != ServiceStatus.DOWN:
27          return None
28
29      ops = [0]
30      start_index = _bisect_incident_start(checks, 0, len(checks) - 1, ops)
31
32      return IncidentPeriod(
33          service_id=service_id,
34          start_check=checks[start_index],
35          is_ongoing=True,
36          operations_count=ops[0],
37      )
```

- **L22-24** — entrada pública. Por defecto mira hasta 200 revisiones hacia atrás.
- **L25** — **→ Parte 2**: trae las revisiones, ascendente.
- **L26-27** — **el corte temprano.** `checks[-1]` es la última revisión de la lista, o sea
  la más reciente. Si no hay ninguna revisión, o si la más reciente **no** está caída, no
  hay ninguna caída pasando ahora mismo → devuelve `None` sin ejecutar ni un solo paso de
  bisección. **Esto es lo que hace que `service_views.py:75` responda
  `active_incident: False`.**
- **L29** — arranca el contador de pasos en 0 (envuelto en una lista, por la razón
  explicada en la L13).
- **L30** — **→ llama a `_bisect_incident_start` (L8)** sobre toda la lista (`0` a
  `len(checks) - 1`).
- **L32-37** — arma el resultado: `start_check` es la revisión **completa** (no solo su
  fecha) que está en el índice que devolvió la bisección; `is_ongoing` siempre `True` acá
  (esta función solo detecta caídas que siguen activas); `operations_count` es el valor
  final del contador.

Con 16 revisiones, este algoritmo encuentra el inicio de la caída en unos 5 pasos de
bisección en vez de mirar las 16 una por una — la misma idea de "cortar a la mitad" que la
búsqueda binaria del Algoritmo 1, pero escrita de forma recursiva en vez de con un bucle.

---

<a name="parte-5"></a>

## Parte 5 — Algoritmo 3: `backend/application/use_cases/calculate_reliability_tier.py`

El archivo más corto de los cuatro. Nadie lo llama directo desde una dirección HTTP: lo
usa el Algoritmo 1 (`calculate_service_stats.py:34`).

```python
1  DEFAULT_TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum"]
2
3
4  def calculate_reliability_tier(uptime_percentage: float, a1: float, d: float, n: int) -> str:
5      """Clasifica uptime_percentage contra n umbrales generados por progresion
6      aritmetica (a1, a1+d, a1+2d, ...). Umbrales siempre parametrizados, nunca hardcodeados."""
7      thresholds = [a1 + i * d for i in range(n)]
8      names = DEFAULT_TIER_NAMES[:n] if n <= len(DEFAULT_TIER_NAMES) else [f"Tier {i + 1}" for i in range(n)]
9
10     tier = "Unranked"
11     for threshold, name in zip(thresholds, names):
12         if uptime_percentage >= threshold:
13             tier = name
14     return tier
```

- **L1** — los cuatro nombres de medalla, en orden de peor a mejor. El orden importa: se
  van a emparejar por posición con los umbrales que arma la L7.
- **L4** — recibe el porcentaje de disponibilidad a clasificar, y los tres parámetros que
  definen la escala: `a1` (primer umbral), `d` (cuánto sube cada escalón) y `n` (cuántos
  escalones/medallas hay). `calculate_service_stats.py:34` la llama con
  `(uptime_pct, 80.0, 5.0, 4)`.
- **L7** — `thresholds = [a1 + i * d for i in range(n)]`: una **lista por comprensión**.
  `range(n)` genera `0, 1, 2, 3`; para cada uno calcula `a1 + i*d`. Con `a1=80, d=5, n=4`:
  `80+0*5=80`, `80+1*5=85`, `80+2*5=90`, `80+3*5=95` → `[80, 85, 90, 95]`. Esa es la
  progresión aritmética: mismo punto de partida, mismo paso sumado cada vez.
- **L8** — elige los nombres a usar: si `n` entra dentro de los 4 nombres predefinidos
  (L1), toma los primeros `n` con `DEFAULT_TIER_NAMES[:n]`; si alguien configurara más de 4
  medallas, genera nombres genéricos `"Tier 1"`, `"Tier 2"`, ... con otra lista por
  comprensión.
- **L10** — valor por defecto si el porcentaje no alcanza ni el primer umbral.
- **L11** — `zip(thresholds, names)` empareja las dos listas por posición:
  `(80, "Bronze"), (85, "Silver"), (90, "Gold"), (95, "Platinum")`, y las recorre **en ese
  orden**, de umbral más bajo a más alto.
- **L12-13** — en cada vuelta, si el porcentaje **es mayor o igual** al umbral de esa
  vuelta, `tier` se sobreescribe con ese nombre. Como el recorrido va de menor a mayor
  umbral, la **última** sobreescritura que se dispare es la del umbral más alto que el
  porcentaje efectivamente alcanza — así que al terminar el bucle, `tier` tiene la mejor
  medalla posible.
  - Ejemplo: 96 % supera 80, 85, 90 y 95 → las cuatro vueltas sobreescriben `tier`, la
    última deja `"Platinum"`.
  - Ejemplo: 87 % supera 80 y 85, pero no 90 ni 95 → se sobreescribe dos veces, queda
    `"Silver"`.
  - Ejemplo: 70 % no supera ninguno → `tier` se queda en `"Unranked"`, tal como arrancó en
    la L10.
- **L14** — devuelve el nombre final.

---

<a name="parte-6"></a>

## Parte 6 — Algoritmo 4: `backend/application/use_cases/predict_latency_trend.py`

```python
 7  def _linear_regression(xs: List[float], ys: List[float]) -> Tuple[float, float]:
 8      """Ajuste por minimos cuadrados manual (sin libs de ML): y = slope*x + intercept.
 9      O(n), un solo recorrido sobre las muestras."""
10      n = len(xs)
11      mean_x = sum(xs) / n
12      mean_y = sum(ys) / n
13      numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
14      denominator = sum((x - mean_x) ** 2 for x in xs)
15      slope = numerator / denominator if denominator else 0.0
16      intercept = mean_y - slope * mean_x
17      return slope, intercept
```

- **L7** — recibe dos listas paralelas, `xs` (posiciones) e `ys` (latencias), y devuelve
  la pendiente y la ordenada al origen de la recta que mejor se ajusta a esos puntos:
  `y = slope * x + intercept`. Es la fórmula de "mínimos cuadrados" escrita a mano, sin
  ninguna librería de estadística o machine learning.
- **L11** — promedio de todas las posiciones.
- **L12** — promedio de todas las latencias.
- **L13** — `numerator`: para cada punto, multiplica qué tan lejos está su `x` del
  promedio de `x` por qué tan lejos está su `y` del promedio de `y`, y suma todo eso. Mide
  si `x` e `y` se mueven juntos (cuando uno sube, el otro también) o no.
- **L14** — `denominator`: para cada punto, eleva al cuadrado qué tan lejos está su `x` del
  promedio de `x`, y suma. Mide qué tan dispersas están las posiciones.
- **L15** — `slope = numerator / denominator`: la fórmula estándar de la pendiente de
  mínimos cuadrados. El `if denominator else 0.0` evita dividir por cero (solo pasaría si
  todas las `x` fueran idénticas, algo que acá no ocurre porque `xs` son posiciones
  0, 1, 2, 3... siempre distintas entre sí).
- **L16** — `intercept`: se despeja de que la recta ajustada siempre pasa por el punto
  `(mean_x, mean_y)`.
- **L17** — devuelve ambos números.

```python
20  def predict_latency_trend(
21      service_id: int,
22      repo: IServiceRepository,
23      critical_threshold_ms: float,
24      window: int = 50,
25  ) -> Optional[LatencyTrend]:
26      checks = repo.get_checks_for_service(service_id, limit=window)
27      samples = [(i, c.response_time_ms) for i, c in enumerate(checks) if c.response_time_ms is not None]
28      if len(samples) < 2:
29          return None
30
31      xs = [s[0] for s in samples]
32      ys = [s[1] for s in samples]
33      slope, intercept = _linear_regression(xs, ys)
34
35      is_degrading = slope > 0
36      checks_to_breach = None
37      if is_degrading:
38          breach_x = (critical_threshold_ms - intercept) / slope
39          remaining = breach_x - xs[-1]
40          checks_to_breach = round(remaining) if remaining > 0 else 0
41
42      return LatencyTrend(
43          service_id=service_id,
44          slope_ms_per_check=round(slope, 4),
45          intercept_ms=round(intercept, 2),
46          is_degrading=is_degrading,
47          predicted_checks_to_breach=checks_to_breach,
48      )
```

- **L20-24** — entrada pública. `critical_threshold_ms` no tiene valor por defecto acá
  adentro — lo tiene que mandar quien llama (`service_views.py:89` le pone 2000 si el
  usuario no especificó nada). `window=50`: mira menos revisiones que los otros algoritmos
  a propósito, porque una tendencia tiene que reflejar el comportamiento **reciente**, no
  todo el historial.
- **L26** — **→ Parte 2**: trae hasta 50 revisiones, ascendente.
- **L27** — `samples = [(i, c.response_time_ms) for i, c in enumerate(checks) if
  c.response_time_ms is not None]`: una lista por comprensión con tres partes:
  - `enumerate(checks)` — recorre la lista entregando pares `(posición, revisión)`:
    `(0, check0), (1, check1), ...`. Esto convierte "el orden en la lista" en un número
    que se puede usar como eje X.
  - `if c.response_time_ms is not None` — descarta las revisiones sin latencia medida
    (por ejemplo, un timeout).
  - El resultado es una lista de pares `(posición, latencia)`.
- **L28-29** — con menos de 2 puntos no se puede trazar una recta (haría falta dividir por
  cero en la L15) → devuelve `None`. **Esto es lo que hace que `TrendIndicator.jsx:6`
  reciba `has_data: false` y no dibuje nada.**
- **L31** — separa solo las posiciones en una lista (`xs`).
- **L32** — separa solo las latencias en otra (`ys`).
- **L33** — **→ llama a `_linear_regression` (L7)** con esas dos listas.
- **L35** — el servicio se considera "empeorando" únicamente si la pendiente es
  **mayor que cero** (la latencia sube a medida que pasan las revisiones). Pendiente plana
  o negativa no cuenta como empeorando.
- **L37-40** — este bloque solo corre si está empeorando:
  - **L38** — despeja de la ecuación de la recta en qué posición `x` (revisión) el valor de
    `y` (latencia) llegaría exactamente al límite crítico: `x = (límite - intercept) /
    slope`.
  - **L39** — a esa posición futura le resta la posición de la **última** revisión real
    (`xs[-1]`), para que el resultado sea "cuántas revisiones **faltan**" en vez de "en qué
    número de revisión pasa".
  - **L40** — si ese resto es positivo, lo redondea a un número entero de revisiones. Si ya
    dio negativo o cero (la recta ya cruzó el límite en el pasado), reporta `0`: "ya se
    cruzó".
- **L42-48** — arma el resultado `LatencyTrend` (Parte 7) — exactamente lo que
  `service_views.py:96-98` lee para construir la respuesta.

---

<a name="parte-7"></a>

## Parte 7 — Las formas de los resultados: `backend/domain/entities/`

Los cuatro algoritmos devuelven objetos de estas clases. Viven en la capa *domain*: son
solo **formas de datos**, sin ningún cálculo adentro.

### `analytics.py` — lo que produce cada algoritmo

```python
 7  @dataclass
 8  class ServiceStats:
 9      service_id: int
10      uptime_percentage: float
11      average_latency_ms: Optional[float]
12      p95_latency_ms: Optional[float]
13      total_checks: int
14      reliability_tier: str
15
16
17  @dataclass
18  class IncidentPeriod:
19      service_id: int
20      start_check: CheckResult
21      is_ongoing: bool
22      operations_count: int
23
24
25  @dataclass
26  class LatencyTrend:
27      service_id: int
28      slope_ms_per_check: float
29      intercept_ms: float
30      is_degrading: bool
31      predicted_checks_to_breach: Optional[int]
```

- `@dataclass` es un decorador de la librería estándar de Python: a partir de la lista de
  campos, genera automáticamente el constructor y otras funciones de utilidad, sin que haya
  que escribirlas a mano. Estas tres clases **no tienen métodos propios**, solo guardan
  los campos que arma cada algoritmo (Parte 3, L36-43; Parte 4, L32-37; Parte 6, L42-48).
- `IncidentPeriod.start_check` guarda el objeto `CheckResult` **completo**, no solo su
  fecha — por eso `service_views.py:80` puede leer `incident.start_check.checked_at`.
- `Optional[float]` / `Optional[int]` significa "puede ser ese tipo, o puede ser `None`":
  refleja los casos donde el algoritmo no tiene suficientes datos para calcular ese campo
  (por ejemplo, `average_latency_ms` es `None` si ninguna revisión tiene latencia medida).

### `service.py` — la revisión y su estado

```python
 7  class ServiceStatus(str, Enum):
 8      UP = 'up'
 9      DOWN = 'down'
10      UNKNOWN = 'unknown'
...
24  @dataclass
25  class CheckResult:
26      service_id: int
27      status: ServiceStatus
28      response_time_ms: Optional[float]
29      status_code: Optional[int]
30      error_message: Optional[str]
31      checked_at: datetime = field(default_factory=datetime.utcnow)
32      id: Optional[int] = None
```

- **`ServiceStatus(str, Enum)`** — un `Enum` es un conjunto fijo y con nombre de valores
  permitidos (acá: `UP`, `DOWN`, `UNKNOWN`). Que además herede de `str` significa que
  `ServiceStatus.UP` se comporta como el texto `'up'` en comparaciones — así el código de
  los algoritmos (`c.status == ServiceStatus.UP`, `checks[mid].status == ServiceStatus.DOWN`)
  es legible y, a la vez, compatible con el texto simple que viene de la base de datos.
- **`CheckResult`** — una revisión: a qué servicio pertenece, su estado, cuánto tardó, el
  código de estado HTTP (si lo hubo), un mensaje de error (si lo hubo) y cuándo se hizo.
  - `field(default_factory=datetime.utcnow)`: si al crear un `CheckResult` no se especifica
    `checked_at`, usa la hora actual — pero llamando a `datetime.utcnow()` **en el momento
    de crear cada objeto**, no una sola vez cuando Python carga el archivo (que es lo que
    pasaría con un valor por defecto común, dejando la misma hora congelada para siempre).

Esta es la lista de objetos `CheckResult` que entra a los cuatro algoritmos, ya ordenada
por `service_repository.py:60` (Parte 2).

---

<a name="parte-8"></a>

## Parte 8 — El recorrido completo, en orden, para los 3 endpoints

### `GET /api/v1/services/42/stats/`

1. `service_views.py:52` — entra el pedido, con `pk = "42"`.
2. `service_views.py:53` — `self.get_object()` busca el servicio 42 **entre los que son
   del usuario logueado**; si no existe o no es suyo, corta acá con 404.
3. `service_views.py:54` — crea el repositorio (Postgres).
4. `service_views.py:55` — llama a **Algoritmo 1**:
   - `calculate_service_stats.py:25` — trae hasta 500 revisiones ascendentes
     (→ `service_repository.py:60-67`).
   - `calculate_service_stats.py:27-28` — cuenta las `UP`, calcula el % de disponibilidad.
   - `calculate_service_stats.py:30-32` — ordena las latencias, calcula promedio y, vía
     `_percentile` (L10), el p95.
   - `calculate_service_stats.py:34` — llama a **Algoritmo 3**
     (`calculate_reliability_tier.py:4`) para obtener la medalla.
   - `calculate_service_stats.py:36-43` — devuelve el `ServiceStats` armado.
5. `service_views.py:56` — `asdict(result)` lo pasa a diccionario.
6. `service_views.py:58-66` — si vino `?at=...`, pide las revisiones **otra vez**
   (L60) y corre la **búsqueda binaria** (`calculate_service_stats.py:46`), agregando
   `nearest_check` al diccionario.
7. `service_views.py:68` — `Response(data)` — responde 200 con el JSON.
8. Llega al navegador y aterriza en `useServiceAnalytics.js:19` como `statsRes.data`
   (ver `docs/FRONTEND_LINEA_POR_LINEA.md`, Parte 3).

### `GET /api/v1/services/42/incidents/`

1. `service_views.py:71` — entra el pedido.
2. `service_views.py:72` — `self.get_object()`, mismo chequeo de dueño.
3. `service_views.py:74` — llama a **Algoritmo 2**:
   - `find_incident_start.py:25` — trae hasta 200 revisiones ascendentes.
   - `find_incident_start.py:26-27` — si la última no está caída (o no hay ninguna),
     devuelve `None` de inmediato.
   - si sí está caída: `find_incident_start.py:30` llama a `_bisect_incident_start`
     (L8), que recorta la lista a la mitad en cada paso hasta encontrar el primer índice
     caído de la racha.
   - `find_incident_start.py:32-37` — devuelve el `IncidentPeriod`.
4. `service_views.py:75-83` — si fue `None`, responde `{'active_incident': False}`; si no,
   arma el objeto con la hora de inicio y el conteo de pasos.
5. Llega a `useServiceAnalytics.js:20` como `incidentRes.data`.

### `GET /api/v1/services/42/trend/`

1. `service_views.py:86` — entra el pedido.
2. `service_views.py:87` — `self.get_object()`.
3. `service_views.py:89` — lee `?critical_ms=...` de la dirección (o usa 2000).
4. `service_views.py:90` — llama a **Algoritmo 4**:
   - `predict_latency_trend.py:26` — trae hasta 50 revisiones ascendentes.
   - `predict_latency_trend.py:27-29` — arma pares `(posición, latencia)`; si hay menos
     de 2, devuelve `None`.
   - `predict_latency_trend.py:33` — llama a `_linear_regression` (L7) para obtener la
     pendiente y la ordenada al origen.
   - `predict_latency_trend.py:35-40` — decide si está empeorando y, si lo está, calcula
     en cuántas revisiones cruzaría el límite.
   - `predict_latency_trend.py:42-48` — devuelve el `LatencyTrend`.
5. `service_views.py:91-99` — si fue `None`, responde `{'has_data': False}`; si no, arma
   el objeto con la pendiente, si empeora, y la predicción.
6. Llega a `useServiceAnalytics.js:21` como `trendRes.data`.

---

<a name="apendice"></a>

## Apéndice — Glosario técnico (Python / algoritmos)

**`dataclass`** — decorador de Python que, a partir de una lista de campos, genera solo el
constructor y funciones de utilidad; la clase no tiene lógica propia, solo guarda datos.
Se usan para las "formas" de resultado (Parte 7) y no para los cálculos en sí.

**`Enum`** — un tipo con un conjunto fijo de valores con nombre (acá: `UP`, `DOWN`,
`UNKNOWN`). Evita comparar contra texto suelto por todos lados.

**Expresión generadora** — `sum(1 for c in checks if ...)` o
`sorted(x for x in ... if ...)`: recorre una secuencia y va produciendo valores uno a uno,
sin construir una lista intermedia completa en memoria. Se distingue de una lista por
comprensión en que no usa corchetes `[...]` sino paréntesis (o directamente ningún
delimitador extra dentro de una llamada como `sum(...)`).

**Lista por comprensión** — `[a1 + i * d for i in range(n)]`: construye una lista nueva
aplicando una expresión a cada elemento de otra secuencia. Es la forma corta de escribir un
bucle que arma una lista.

**`enumerate(lista)`** — recorre una lista entregando pares `(posición, elemento)` en vez
de solo el elemento. Se usa para convertir "el orden dentro de la lista" en un número
utilizable como eje X (Parte 6, L27).

**`zip(lista1, lista2)`** — recorre dos listas **a la vez**, entregando pares tomados de
la misma posición de cada una. Se usa para emparejar umbrales con nombres de medalla
(Parte 5, L11).

**Slicing / `lista[:n]`** — toma los primeros `n` elementos de una lista.
`lista[::-1]`/`reversed(lista)` la da vuelta.

**Recursión** — una función que se llama a sí misma con una versión más chica del
problema, hasta llegar a un **caso base** que ya no necesita seguir llamándose (Parte 4,
`_bisect_incident_start`, caso base en `lo == hi`). Sin caso base, se llamaría para
siempre.

**Complejidad `O(...)`** — una forma de describir cuánto crece el trabajo de un algoritmo a
medida que crecen los datos de entrada:
- `O(n)` (lineal) — el trabajo crece al mismo ritmo que los datos: el doble de datos, el
  doble de trabajo. La búsqueda lineal (Parte 3.4) y la regresión (Parte 6) son así.
- `O(log n)` (logarítmico) — el trabajo crece mucho más lento que los datos: duplicar los
  datos apenas suma **un paso más**. La búsqueda binaria (Parte 3.3) y la bisección
  (Parte 4) son así, porque cada paso descarta la mitad de lo que quedaba.

**Precondición** — algo que una función **asume** que ya es cierto antes de que la llamen,
y que no vuelve a chequear por su cuenta. Ejemplo: la búsqueda binaria y la bisección
asumen que la lista de revisiones ya viene ordenada ascendente; si no lo estuviera,
darían resultados incorrectos sin avisar.

**Mínimos cuadrados** — el método estándar para encontrar la recta que mejor se ajusta a
un conjunto de puntos, minimizando la suma de las distancias verticales al cuadrado entre
cada punto y la recta. `_linear_regression` (Parte 6) lo implementa a mano con sumas y
promedios, sin ninguna librería externa.

**Percentil** — el valor por debajo del cual cae un determinado porcentaje de las
muestras, una vez ordenadas. El p95 (Parte 3.1) es el valor por debajo del cual cae el
95 % de las mediciones.

**Capas (domain / application / infrastructure / interfaces)** — la separación que sigue
todo el backend: `domain` define formas de datos y contratos sin lógica ni dependencias
externas; `application` (los 4 algoritmos) contiene la lógica de negocio, dependiendo solo
de `domain`; `infrastructure` implementa esos contratos hablando con Postgres;
`interfaces` (las vistas HTTP) conecta pedidos web con casos de uso. La regla es que las
dependencias solo miran "hacia adentro": `interfaces` puede usar `application`, que puede
usar `domain`, pero `domain` no sabe que existen las otras tres.
