# Funciones y operaciones de los 4 algoritmos — referencia para exposición

Confirmación directa: sí, el algoritmo 1 (búsqueda binaria) vive en `backend/application/use_cases/calculate_service_stats.py`, junto a las estadísticas (uptime, latencia, p95) que lo disparan. No es un archivo dedicado solo a búsqueda binaria — es el caso de uso "stats", y la búsqueda binaria es una función más dentro de ese archivo.

Este documento va función por función, de los 4 archivos, explicando qué operación matemática/algorítmica hace cada línea relevante y quién la llama.

---

## Algoritmo 1 — Búsqueda binaria + estadísticas

**Archivo:** `backend/application/use_cases/calculate_service_stats.py`
**Quién lo llama:** `backend/interfaces/http/views/service_views.py` → `ServiceViewSet.stats()`

### Función `_percentile(sorted_values, pct)`

```python
def _percentile(sorted_values: List[float], pct: float) -> float:
    if not sorted_values:
        return 0.0
    index = min(len(sorted_values) - 1, int(len(sorted_values) * pct))
    return sorted_values[index]
```

- Recibe una lista **ya ordenada** de latencias y un percentil (`0.95` para p95).
- `int(len(sorted_values) * pct)`: calcula qué índice de la lista corresponde a ese percentil. Ej: 100 valores, `pct=0.95` → índice 95 → el valor que deja 95% de las muestras por debajo.
- `min(len(sorted_values) - 1, ...)`: protección de límite — evita `IndexError` cuando `pct=1.0` exacto (índice caería fuera de rango).
- Operación: indexado directo, O(1) una vez que la lista está ordenada. El costo real está en el `sorted()` que se hace antes de llamarla (ver abajo).

### Función `calculate_service_stats(service_id, repo, tier_a1, tier_d, tier_n, window)`

```python
def calculate_service_stats(
    service_id: int, repo: IServiceRepository,
    tier_a1: float = 80.0, tier_d: float = 5.0, tier_n: int = 4, window: int = 500,
) -> ServiceStats:
    checks = repo.get_checks_for_service(service_id, limit=window)
    total = len(checks)
    up_count = sum(1 for c in checks if c.status == ServiceStatus.UP)
    uptime_pct = (up_count / total * 100) if total else 0.0

    latencies = sorted(c.response_time_ms for c in checks if c.response_time_ms is not None)
    avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else None
    p95_latency = round(_percentile(latencies, 0.95), 2) if latencies else None

    tier = calculate_reliability_tier(uptime_pct, tier_a1, tier_d, tier_n)

    return ServiceStats(
        service_id=service_id, uptime_percentage=round(uptime_pct, 2),
        average_latency_ms=avg_latency, p95_latency_ms=p95_latency,
        total_checks=total, reliability_tier=tier,
    )
```

Paso a paso:

1. `repo.get_checks_for_service(service_id, limit=window)`: trae del repositorio (Postgres) los últimos 500 checks del servicio, ya ordenados ascendente por fecha. `window` es parámetro con default 500 — nunca hardcodeado dentro del cuerpo de la función.
2. `up_count = sum(1 for c in checks if c.status == ServiceStatus.UP)`: cuenta cuántos checks están UP. Operación O(n) sobre la ventana.
3. `uptime_pct = up_count / total * 100`: regla de tres simple — porcentaje de disponibilidad.
4. `latencies = sorted(...)`: ordena las latencias de menor a mayor. Esto es lo que hace posible calcular el percentil por indexado directo después. Costo O(n log n), pero n ≤ 500, así que es trivial (~500 * 9 ≈ 4500 comparaciones, microsegundos).
5. `avg_latency`: promedio aritmético simple.
6. `p95_latency`: llama a `_percentile` explicada arriba.
7. `calculate_reliability_tier(...)`: delega el algoritmo 3 (progresión aritmética) — ver más abajo. Este es el punto exacto donde el algoritmo 3 se ejecuta "adentro" del algoritmo 1, como dice `FLUJO_ALGORITMOS.md`.
8. Devuelve la entidad `ServiceStats` (dataclass en `domain/entities/analytics.py`) con todo empaquetado.

### Función `find_check_by_timestamp_binary(checks, target)` — el algoritmo 1 propiamente dicho

```python
def find_check_by_timestamp_binary(
    checks: List[CheckResult], target: datetime
) -> Tuple[Optional[CheckResult], int]:
    lo, hi = 0, len(checks) - 1
    operations = 0
    best = None
    while lo <= hi:
        operations += 1
        mid = (lo + hi) // 2
        best = checks[mid]
        if checks[mid].checked_at == target:
            return checks[mid], operations
        if checks[mid].checked_at < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return best, operations
```

- `lo, hi = 0, len(checks) - 1`: los dos punteros que delimitan el rango de búsqueda, arrancan cubriendo toda la lista.
- `while lo <= hi`: el bucle sigue mientras el rango no se haya cerrado del todo.
- `mid = (lo + hi) // 2`: punto medio del rango actual — la operación central del algoritmo, la que le da el nombre "binaria" (divide el problema a la mitad en cada paso).
- `checks[mid].checked_at == target`: si el elemento del medio es exactamente el buscado, termina ahí (mejor caso, O(1) si el target cae justo en el primer mid).
- `checks[mid].checked_at < target: lo = mid + 1`: si el timestamp del medio es anterior al buscado, descarta toda la mitad izquierda (el target no puede estar ahí porque la lista está ordenada ascendente) y sigue buscando a la derecha.
- `else: hi = mid - 1`: caso contrario, descarta la mitad derecha.
- `best = checks[mid]` se actualiza en cada vuelta — por eso, aunque no haya match exacto, la función siempre devuelve el elemento más cercano al `target` cuando el bucle termina (`lo > hi`).
- `operations` cuenta cuántas veces pasó por el bucle — es lo que después se expone en la API (`search_operations` en la respuesta de `/stats/?at=`) y lo que los tests usan para verificar que la complejidad es logarítmica.
- **Complejidad:** mejor caso O(1), peor caso O(log n). Con `window=500`, peor caso ≈ 9 iteraciones.

**Cómo se usa desde afuera** (`service_views.py::stats`, línea 58-66): solo se ejecuta si la request trae `?at=<timestamp>` en la URL. Si no viene ese parámetro, `calculate_service_stats` corre igual (uptime, latencia, tier) pero la búsqueda binaria ni se llama — es opcional, sirve para "qué estado tenía el servicio en tal momento exacto".

### Función `find_check_by_timestamp_linear(checks, target)` — referencia de comparación

```python
def find_check_by_timestamp_linear(
    checks: List[CheckResult], target: datetime
) -> Tuple[Optional[CheckResult], int]:
    best = None
    best_diff = None
    operations = 0
    for check in checks:
        operations += 1
        diff = abs((check.checked_at - target).total_seconds())
        if best_diff is None or diff < best_diff:
            best_diff = diff
            best = check
    return best, operations
```

- Recorre **todos** los elementos sin cortar nunca (no hay `break`), calculando la diferencia absoluta en segundos contra el target y quedándose con el mínimo.
- `operations` termina siempre igual a `len(checks)` — no existe mejor caso real de corte anticipado en esta implementación.
- No se usa en producción. Existe solo para que el test `test_binary_and_linear_search_agree_on_result` y `test_binary_search_stays_logarithmic_at_full_window` puedan demostrar, con números reales, cuánto más eficiente es la binaria (9 operaciones vs 500).

---

## Algoritmo 2 — Recursión (bisección) para inicio de incidente

**Archivo:** `backend/application/use_cases/find_incident_start.py`
**Quién lo llama:** `service_views.py` → `ServiceViewSet.incidents()`

### Función `_bisect_incident_start(checks, lo, hi, ops)` — la recursión

```python
def _bisect_incident_start(checks: List[CheckResult], lo: int, hi: int, ops: List[int]) -> int:
    ops[0] += 1
    if lo == hi:
        return lo
    mid = (lo + hi) // 2
    if checks[mid].status == ServiceStatus.DOWN:
        return _bisect_incident_start(checks, lo, mid, ops)
    return _bisect_incident_start(checks, mid + 1, hi, ops)
```

- **Precondición** (documentada en el docstring del código real y en `PRUEBA_ALGORITMOS.md`): el último check de la ventana (`checks[hi]`) está DOWN, y la caída es continua hasta ahí (sin altibajos). Bajo esa condición, el algoritmo busca el primer índice de esa racha DOWN.
- `ops[0] += 1`: cuenta la llamada. Se pasa `ops` como lista de un elemento (en vez de un `int` normal) porque las funciones recursivas en Python no pueden mutar un entero externo directamente por referencia — una lista sí es mutable, así cada llamada recursiva incrementa el mismo contador compartido.
- `if lo == hi: return lo`: **caso base** de la recursión — cuando el rango se reduce a un solo elemento, ese es el índice de inicio del incidente.
- `mid = (lo + hi) // 2`: mismo cálculo de punto medio que en la búsqueda binaria — es la misma idea de "dividir a la mitad", aplicada de forma recursiva en vez de iterativa.
- `if checks[mid].status == ServiceStatus.DOWN: return _bisect_incident_start(checks, lo, mid, ops)`: si el elemento del medio ya está caído, el inicio del incidente está en la mitad izquierda (inclusive `mid`) — se llama a sí misma reduciendo el rango a `[lo, mid]`.
- `return _bisect_incident_start(checks, mid + 1, hi, ops)`: si el medio todavía está UP, el incidente empezó después — se llama a sí misma con el rango `[mid+1, hi]`.
- **Profundidad de recursión:** cada llamada reduce el rango a la mitad, así que la profundidad máxima es `log2(n)`. Con `window=200` (default de este algoritmo), profundidad ≈ 8 — muy lejos del límite de recursión de Python (~1000 por defecto).
- **Complejidad:** O(log n), siempre — no hay mejor/peor caso distinto acá porque siempre bisecta hasta llegar al caso base.

### Función `find_incident_start(service_id, repo, window)` — el caso de uso

```python
def find_incident_start(
    service_id: int, repo: IServiceRepository, window: int = 200
) -> Optional[IncidentPeriod]:
    checks = repo.get_checks_for_service(service_id, limit=window)
    if not checks or checks[-1].status != ServiceStatus.DOWN:
        return None

    ops = [0]
    start_index = _bisect_incident_start(checks, 0, len(checks) - 1, ops)

    return IncidentPeriod(
        service_id=service_id, start_check=checks[start_index],
        is_ongoing=True, operations_count=ops[0],
    )
```

- `if not checks or checks[-1].status != ServiceStatus.DOWN: return None`: chequeo de guarda — si no hay checks, o si el último check está UP, **no hay incidente activo**, y ni siquiera se llama a la recursión. Esto responde la pregunta "¿qué pasa si el servicio está bien ahora?" — la respuesta es que el algoritmo recursivo nunca se ejecuta, corta antes.
- `ops = [0]`: inicializa el contador compartido que se va a pasar a través de todas las llamadas recursivas.
- `_bisect_incident_start(checks, 0, len(checks) - 1, ops)`: arranca la recursión cubriendo toda la ventana.
- Devuelve `IncidentPeriod`, que incluye `operations_count` — expuesto en la API como `search_operations` (línea 82 de `service_views.py`), la misma idea que en el algoritmo 1: exponer la métrica de eficiencia en la respuesta HTTP, no solo internamente.

**Límite conocido y ya testeado** (`test_incident_longer_than_window_reports_window_start_not_real_start`): si la caída empezó antes del rango que trajo `window=200`, el algoritmo no tiene forma de saberlo — reporta `checks[0]` (el borde de la ventana) como inicio, no el inicio real.

---

## Algoritmo 3 — Progresión aritmética (tiers de confiabilidad)

**Archivo:** `backend/application/use_cases/calculate_reliability_tier.py`
**Quién lo llama:** `calculate_service_stats.py` (algoritmo 1), internamente — no tiene endpoint HTTP propio.

```python
DEFAULT_TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum"]

def calculate_reliability_tier(uptime_percentage: float, a1: float, d: float, n: int) -> str:
    thresholds = [a1 + i * d for i in range(n)]
    names = DEFAULT_TIER_NAMES[:n] if n <= len(DEFAULT_TIER_NAMES) else [f"Tier {i + 1}" for i in range(n)]

    tier = "Unranked"
    for threshold, name in zip(thresholds, names):
        if uptime_percentage >= threshold:
            tier = name
    return tier
```

- `thresholds = [a1 + i * d for i in range(n)]`: **la progresión aritmética propiamente dicha**. Fórmula clásica `aₙ = a₁ + (n-1)·d`, generada acá para `i = 0, 1, ..., n-1`. Con los defaults del sistema (`a1=80.0, d=5.0, n=4`): `[80.0, 85.0, 90.0, 95.0]` — Bronze desde 80%, Silver desde 85%, Gold desde 90%, Platinum desde 95%.
- `a1`, `d`, `n` son siempre parámetros de función — nunca constantes fijas en el cuerpo, por eso el test `test_thresholds_are_parametrized_not_hardcoded` prueba con valores distintos (`a1=40, d=10, n=2`) y confirma que el resultado cambia en consecuencia.
- `names = DEFAULT_TIER_NAMES[:n] if n <= 4 else [...]`: si piden más de 4 tiers, genera nombres genéricos (`Tier 1`, `Tier 2`, ...) en vez de fallar — pero con los defaults del sistema siempre son los 4 nombres reales.
- `for threshold, name in zip(thresholds, names): if uptime_percentage >= threshold: tier = name`: recorre los umbrales de menor a mayor, y se va quedando con el **último** que cumple (`>=`). Por eso, si `uptime_percentage=99`, cumple los 4 umbrales y termina en `"Platinum"` (el último de la lista), no en el primero que matchea.
- Si no cumple ni el primer umbral (`uptime_percentage < a1`), el bucle nunca actualiza `tier`, y devuelve el valor inicial `"Unranked"`.
- **Complejidad:** O(n) sobre la cantidad de tiers — con `n=4` es irrelevante en la práctica, nunca va a ser un problema de rendimiento sin importar cuántos checks tenga el servicio (no depende del volumen de datos, solo de cuántos umbrales se configuren).

---

## Algoritmo 4 — Regresión lineal (predicción de degradación de latencia)

**Archivo:** `backend/application/use_cases/predict_latency_trend.py`
**Quién lo llama:** `service_views.py` → `ServiceViewSet.trend()`

### Función `_linear_regression(xs, ys)`

```python
def _linear_regression(xs: List[float], ys: List[float]) -> Tuple[float, float]:
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    denominator = sum((x - mean_x) ** 2 for x in xs)
    slope = numerator / denominator if denominator else 0.0
    intercept = mean_y - slope * mean_x
    return slope, intercept
```

Implementación manual del método de **mínimos cuadrados** (sin librerías de ML tipo numpy/sklearn):

- `mean_x`, `mean_y`: promedio de las X (índice de orden del check: 0, 1, 2, ...) y de las Y (latencia en ms de cada check).
- `numerator = Σ(x - x̄)(y - ȳ)`: covarianza entre X e Y (sin dividir por n) — mide cuánto se mueven juntas las dos variables.
- `denominator = Σ(x - x̄)²`: varianza de X (sin dividir por n) — mide cuánto se dispersan los índices (siempre positivo salvo un único punto).
- `slope = numerator / denominator`: la pendiente de la recta que mejor ajusta los puntos — fórmula estándar de regresión lineal simple `m = Σ(x-x̄)(y-ȳ) / Σ(x-x̄)²`. Positiva = latencia sube con el tiempo (degradación); negativa o cero = estable o mejorando.
- `intercept = ȳ - m·x̄`: el punto donde la recta cruza el eje Y, despejado de la ecuación de la recta `y = mx + b`.
- `if denominator else 0.0`: guarda contra división por cero (pasaría solo si todos los `xs` fueran iguales, imposible acá porque `xs` son índices únicos 0,1,2...).
- **Complejidad:** O(n), un solo recorrido para las medias y otro para numerador/denominador — dos pasadas sobre la ventana, sigue siendo lineal.

### Función `predict_latency_trend(service_id, repo, critical_threshold_ms, window)`

```python
def predict_latency_trend(
    service_id: int, repo: IServiceRepository, critical_threshold_ms: float, window: int = 50,
) -> Optional[LatencyTrend]:
    checks = repo.get_checks_for_service(service_id, limit=window)
    samples = [(i, c.response_time_ms) for i, c in enumerate(checks) if c.response_time_ms is not None]
    if len(samples) < 2:
        return None

    xs = [s[0] for s in samples]
    ys = [s[1] for s in samples]
    slope, intercept = _linear_regression(xs, ys)

    is_degrading = slope > 0
    checks_to_breach = None
    if is_degrading:
        breach_x = (critical_threshold_ms - intercept) / slope
        remaining = breach_x - xs[-1]
        checks_to_breach = round(remaining) if remaining > 0 else 0

    return LatencyTrend(
        service_id=service_id, slope_ms_per_check=round(slope, 4), intercept_ms=round(intercept, 2),
        is_degrading=is_degrading, predicted_checks_to_breach=checks_to_breach,
    )
```

- `samples = [(i, c.response_time_ms) for i, c in enumerate(checks) if ...]`: arma pares `(índice, latencia)`, descartando checks sin latencia registrada (ej. si el servicio estuvo DOWN y no hubo respuesta que medir).
- `if len(samples) < 2: return None`: con 0 o 1 muestra no se puede trazar una recta — no hay suficiente información, devuelve `None` en vez de forzar un cálculo sin sentido. Esto es lo que testea `test_returns_none_with_insufficient_data`.
- `xs`, `ys`: separa los índices y las latencias en dos listas para pasarlas a `_linear_regression`.
- `is_degrading = slope > 0`: si la pendiente es positiva, la latencia está subiendo check a check.
- **La proyección — la parte "predictiva" del algoritmo:**
  - `breach_x = (critical_threshold_ms - intercept) / slope`: despeja `x` de la ecuación de la recta `y = slope·x + intercept`, preguntando "¿en qué valor de x (qué número de check) la recta cruza el umbral crítico?". Es álgebra directa: `y = mx+b → x = (y-b)/m`.
  - `remaining = breach_x - xs[-1]`: resta el índice del último check real al punto de cruce proyectado — cuántos checks faltan, desde ahora, para llegar al umbral.
  - `checks_to_breach = round(remaining) if remaining > 0 else 0`: si la proyección da negativa (ya se cruzó el umbral en el pasado según la recta), reporta 0 en vez de un número negativo sin sentido.
- Si `is_degrading` es `False` (pendiente ≤ 0), `checks_to_breach` queda en `None` — no tiene sentido proyectar un cruce si la tendencia no sube. Esto es lo que testea `test_stable_trend_is_not_degrading`.

---

## Cómo se conectan los 4 en una sola respuesta de API

Desde `backend/interfaces/http/views/service_views.py`, `ServiceViewSet` expone 3 endpoints (`@action`) que el frontend pide en paralelo (`Promise.all` en `useServiceAnalytics.js`):

```python
@action(detail=True, methods=['get'])
def stats(self, request, pk=None):
    service = self.get_object()
    repo = DjangoServiceRepository()
    result = calculate_service_stats(service.id, repo)     # algoritmo 1 (y adentro, algoritmo 3)
    data = asdict(result)
    at_param = request.query_params.get('at')
    if at_param:
        checks = repo.get_checks_for_service(service.id, limit=500)
        nearest, operations = find_check_by_timestamp_binary(checks, datetime.fromisoformat(at_param))
        data['nearest_check'] = {...}
    return Response(data)

@action(detail=True, methods=['get'])
def incidents(self, request, pk=None):
    ...
    incident = find_incident_start(service.id, repo)        # algoritmo 2
    ...

@action(detail=True, methods=['get'])
def trend(self, request, pk=None):
    ...
    critical_ms = float(request.query_params.get('critical_ms', 2000))
    trend = predict_latency_trend(service.id, repo, critical_threshold_ms=critical_ms)  # algoritmo 4
    ...
```

Puntos clave para la exposición:

- `repo = DjangoServiceRepository()` se instancia **en la vista**, no dentro de los use cases — los use cases reciben `repo` como parámetro tipado contra la interfaz `IServiceRepository` (dominio), nunca importan la implementación concreta. Es la aplicación de Dependency Inversion (capa `application/` nunca depende de `infrastructure/`).
- `asdict(result)`: convierte el dataclass `ServiceStats` a diccionario plano para serializar a JSON.
- El algoritmo 1 corre siempre que se pide `/stats/`; la búsqueda binaria (`find_check_by_timestamp_binary`) solo corre si además viene `?at=`. Son dos ejecuciones independientes dentro del mismo endpoint.
- El `critical_ms` del algoritmo 4 tiene default `2000` (2 segundos) si no se pasa por query param — parametrizable desde el frontend sin tocar backend.

---

## Resumen — operación central de cada algoritmo, en una línea

| # | Algoritmo | Archivo | Operación central |
|---|---|---|---|
| 1 | Búsqueda binaria | `calculate_service_stats.py` | `mid = (lo + hi) // 2`, descarta mitad según comparación de timestamps |
| 2 | Recursión (bisección) | `find_incident_start.py` | Misma idea de `mid`, pero la función se llama a sí misma en vez de iterar con `while` |
| 3 | Progresión aritmética | `calculate_reliability_tier.py` | `thresholds = [a1 + i * d for i in range(n)]` |
| 4 | Regresión lineal | `predict_latency_trend.py` | `slope = Σ(x-x̄)(y-ȳ) / Σ(x-x̄)²`, luego `x = (y-b)/m` para proyectar el cruce |
