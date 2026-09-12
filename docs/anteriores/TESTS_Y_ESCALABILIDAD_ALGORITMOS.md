# Tests y escalabilidad de los 4 algoritmos

Responde dos preguntas puntuales: ¿hay tests que pongan a prueba los 4 algoritmos? ¿soporta el sistema 500 millones de registros en `check_results`?

---

## 1. ¿Hay tests?

Sí, los 4 tienen test unitario propio en `backend/tests/unit/`:

| Algoritmo | Archivo | Qué cubre |
|---|---|---|
| 1. Búsqueda binaria + stats | `test_calculate_service_stats.py` | uptime %, tier embebido, binaria vs lineal coinciden en resultado y binaria hace menos operaciones |
| 2. Recursión/bisección incidente | `test_find_incident_start.py` | sin incidente si último check es UP, encuentra inicio correcto, `test_operations_count_is_logarithmic` verifica ops ≤ log2(n) |
| 3. Progresión aritmética (tier) | `test_calculate_reliability_tier.py` | umbral no alcanzado, primer umbral, umbral más alto, parámetros no hardcodeados |
| 4. Regresión lineal (trend) | `test_predict_latency_trend.py` | detecta tendencia degradante, estable no marca degradación, datos insuficientes devuelve `None` |

`docs/FLUJO_ALGORITMOS.md` (línea 226) queda desactualizado: dice que solo existen tests para algoritmo 1 y 2, pero algoritmo 3 y 4 también los tienen. Corregir esa tabla en algún momento.

**Gaps reales — lo que NO está probado:**

1. **Ningún test mide rendimiento con volumen.** Todos usan listas pequeñas (2-20 elementos) vía `MagicMock` en el repo. Nadie verifica qué pasa cuando `get_checks_for_service` devuelve el `window` completo (500 / 200 / 50 elementos) ni qué pasa a nivel SQL con una tabla grande.
2. **Ningún test de integración toca PostgreSQL real.** Todo es unitario contra el use case puro; el repositorio (`DjangoServiceRepository.get_checks_for_service`) no tiene test propio. La carpeta `backend/tests/integration/` existe pero está vacía (`__init__.py` solo).
3. **No hay test para el caso límite documentado:** una racha `DOWN` más larga que `window` (200 checks). `find_incident_start` asumiría que el check en el índice 0 de la ventana es el inicio real del incidente, cuando en realidad empezó antes — devolvería un `start_check` incorrecto (no un crash, un dato erróneo). Está anotado como precondición en `docs/PRUEBA_ALGORITMOS.md` punto 2 pero no hay assertion que lo cubra.

---

## 2. ¿Soporta 500 millones de registros en `check_results`?

Depende de qué parte del sistema. Separando el análisis:

### La parte que SÍ escala bien: los 4 algoritmos en sí

Los 3 use cases que leen datos nunca cargan la tabla completa — piden una ventana acotada:

```python
calculate_service_stats(..., window: int = 500)
find_incident_start(..., window: int = 200)
predict_latency_trend(..., window: int = 50)
```

`get_checks_for_service(service_id, limit=window)` aplica el límite en SQL (`.order_by('-checked_at')[:limit]`), no en Python. Entonces:
- Búsqueda binaria opera sobre máximo 500 elementos en memoria → O(log 500) ≈ 9 operaciones, sin importar si la tabla tiene 500 filas o 500 millones.
- Bisección recursiva opera sobre máximo 200 → profundidad de recursión ≈ 8, lejos del límite de recursión de Python (1000 default).
- Regresión lineal opera sobre máximo 50 → trivial.
- Progresión aritmética opera sobre `n` tiers (típicamente 4), totalmente independiente del volumen de checks.

**Conclusión: el código de los algoritmos no es el cuello de botella. El cuello de botella, si existe, está en la query que arma esa ventana.**

### La parte que NO está verificada: la query que alimenta la ventana

`backend/infrastructure/models.py` — `CheckResultModel`:

```python
class Meta:
    db_table = 'check_results'
    ordering = ['-checked_at']
```

- `ordering` en `Meta` **no crea índice**, solo afecta el `ORDER BY` por defecto. No hay `db_index=True` en `checked_at` ni un `indexes = [...]` con índice compuesto.
- Sí existe índice implícito en `service_id` (Django lo crea automático por ser `ForeignKey`).
- La query real es `filter(service_id=X).order_by('-checked_at')[:limit]`. Con índice solo en `service_id`, Postgres filtra por servicio (rápido) pero después tiene que **ordenar en memoria** ese subconjunto por `checked_at` antes de aplicar el `LIMIT`. Con una tabla de 500M filas totales, si un servicio individual acumuló, por ejemplo, 2-5 millones de checks (posible tras años de polling cada 30-60s), ese sort intermedio ya no es gratis.

**Fix concreto, no implementado todavía:**

```python
class Meta:
    db_table = 'check_results'
    ordering = ['-checked_at']
    indexes = [
        models.Index(fields=['service_id', '-checked_at']),
    ]
```

Con índice compuesto `(service_id, checked_at DESC)`, la query pasa de "filtrar + sort en memoria" a "index scan que ya entrega los datos ordenados", O(log n + limit) en vez de O(k log k) donde k = checks del servicio.

### Otros puntos de escala fuera del código de los algoritmos

- **Escritura:** `save_check_result` hace un `INSERT` por check. A 500M filas acumuladas, eso es normal para series temporales (write-heavy, append-only) — no es un problema de este código, es un problema de infraestructura de PostgreSQL (particionado por fecha, o mover a TimescaleDB/hypertable si el volumen real se acerca a esa escala).
- **Recursión (algoritmo 2):** el límite de recursión de Python (~1000 frames) nunca se alcanza porque `window=200` ⇒ profundidad ≈ 8. Solo sería riesgo si alguien sube `window` a >2000 sin cambiar el algoritmo a iterativo. No es el caso actual.
- **`get_consecutive_failures`** (usado para alertas, no es uno de los 4 algoritmos pero toca la misma tabla): mismo patrón `order_by('-checked_at')[:20]`, mismo problema de índice ausente.

---

## 3. ¿Se pueden crear los tests que faltan?

Sí. Tres tests nuevos, sin tocar producción, cubren los gaps de la sección 1:

**a) Test de escala en memoria (unitario, rápido, sin DB)** — confirma que la complejidad se mantiene con `window` lleno:

```python
def test_binary_search_stays_logarithmic_at_full_window():
    checks = _make_checks([ServiceStatus.UP] * 500)  # window real de stats
    target = checks[250].checked_at
    _, ops = find_check_by_timestamp_binary(checks, target)
    assert ops <= 10  # log2(500) ~ 9
```

**b) Test del caso límite de incidente más largo que la ventana** — cubre el gap #3 de la sección 1:

```python
def test_incident_longer_than_window_reports_window_start_not_real_start():
    checks = _make_checks([ServiceStatus.DOWN] * 200)  # toda la ventana caída
    incident = find_incident_start(1, repo_with(checks))
    assert incident.start_check == checks[0]  # documenta la limitación, no la oculta
```

**c) Test de integración contra PostgreSQL real con volumen** — cubre el gap #2, marcado `slow` para no correr en cada `pytest` normal:

```python
@pytest.mark.slow
@pytest.mark.django_db
def test_get_checks_for_service_with_large_dataset_uses_limit(django_assert_num_queries):
    service = ServiceModel.objects.create(name="x", url="http://x")
    CheckResultModel.objects.bulk_create([
        CheckResultModel(service=service, status="up", response_time_ms=100, status_code=200)
        for _ in range(50_000)
    ], batch_size=5000)

    with django_assert_num_queries(1):
        result = DjangoServiceRepository().get_checks_for_service(service.id, limit=500)
    assert len(result) == 500
```

Este último es el que realmente contesta "aguanta 500 millones" — pero para eso hace falta una tabla con volumen real (o al menos suficiente para forzar Postgres a usar o no el índice), y correrlo con `EXPLAIN ANALYZE` antes/después de agregar el índice compuesto propuesto arriba, para tener el número real en vez de estimarlo.

---

## Resumen

| Pregunta | Respuesta |
|---|---|
| ¿Hay tests de los 4 algoritmos? | Sí, unitarios, uno por algoritmo, ya en el repo |
| ¿Cubren volumen/escala? | No — todos usan listas pequeñas simuladas |
| ¿El código del algoritmo aguanta 500M filas? | Sí, porque nunca opera sobre más de `window` elementos (50-500) |
| ¿La query que alimenta esos algoritmos aguanta 500M filas? | No verificado — falta índice compuesto `(service_id, checked_at)` en `CheckResultModel` |
| ¿Se puede testear esto? | Sí — 3 tests propuestos arriba, ninguno implementado todavía |
