# Plan — Algoritmos aplicados a Sentinel

## Objetivo

Aplicar 4 técnicas de análisis de algoritmos (requisito académico, libre elección de dominio) sobre datos reales de Sentinel — no sintéticos — reusando el historial que el sistema ya acumula en `CheckResultModel` (`response_time_ms`, `checked_at`, `status` por servicio). Cada técnica se implementa como caso de uso nuevo en `application/use_cases/`, respetando Clean Architecture existente: sin lógica en views, sin dependencias de Django en `domain/`.

Cada algoritmo debe documentar: complejidad Big O, mejor/peor caso, y conteo real de operaciones (no solo tiempo de reloj) — mismo estándar que `appresso-algoritmos`.

---

## 1. Búsqueda + estadísticas de servicio

**Qué resuelve:** dado un servicio, calcular uptime %, latencia promedio, p95, y buscar un check puntual (por id o por timestamp más cercano) sobre su historial.

**Por qué es valioso acá (no forzado):** `CheckResultViewSet` ya filtra por query params vía ORM (índice de Postgres). El caso de uso demuestra manualmente la comparación búsqueda lineal vs búsqueda binaria sobre la lista ordenada por `checked_at`, con conteo de operaciones — el ORM resuelve el caso de uso real, el algoritmo manual es la pieza académica que se reporta aparte.

**Nuevo:**
- `application/use_cases/calculate_service_stats.py`
- `application/use_cases/find_check_by_timestamp.py` (búsqueda binaria, recibe lista ya ordenada)
- Método nuevo en `IServiceRepository`: `get_checks_for_service(service_id, since=None) -> List[CheckResult]`
- Endpoint: `GET /api/v1/services/{id}/stats/`

---

## 2. Recursión (divide y vencer) — inicio de incidente

**Qué resuelve:** dado un rango de tiempo donde un servicio cayó, encontrar el check exacto donde `status` pasó de `up` a `down`, por bisección recursiva en vez de recorrer todo el historial linealmente.

**Por qué es valioso:** hoy Sentinel solo registra cada check individual — no calcula "cuándo empezó" un incidente. Esto es feature nueva, no cosmética.

**Nuevo:**
- `application/use_cases/find_incident_start.py` (recursivo, O(log n) vs O(n) lineal de referencia para el reporte)
- Endpoint: `GET /api/v1/services/{id}/incidents/`

---

## 3. Progresión aritmética — tiers de confiabilidad

**Qué resuelve:** clasificar cada servicio en un nivel (ej. Bronze/Silver/Gold/Platinum) según uptime % acumulado, usando umbrales generados por progresión aritmética (`a1`, `d`, `n` como parámetros — nunca hardcodeados, mismo criterio que `appresso-algoritmos`).

**Por qué es valioso:** hoy no existe ninguna clasificación de calidad de servicio en el dashboard. Se muestra como badge en `ServiceDetailPage`.

**Nuevo:**
- `application/use_cases/calculate_reliability_tier.py` (recibe `a1`, `d`, `n`, `uptime_pct` como parámetros)
- Incluido en la respuesta de `stats/` (punto 1), no requiere endpoint propio

---

## 4. Regresión lineal — predicción de degradación

**Qué resuelve:** sobre los últimos N checks de un servicio, ajustar regresión lineal manual (`response_time_ms` vs tiempo) para detectar tendencia de degradación y proyectar cuándo cruzaría un umbral crítico — alerta preventiva antes de la caída, no reactiva.

**Por qué es valioso:** hoy Sentinel solo alerta cuando ya está `down` (`consecutive_failures`, `latency_above`). Esto agrega una tercera condición de alerta: tendencia.

**Nuevo:**
- `application/use_cases/predict_latency_trend.py`
- Integración opcional con `AlertRuleModel`: nueva condición `latency_trend_degrading`
- Endpoint: `GET /api/v1/services/{id}/trend/`

---

## Capas afectadas

```
domain/        → sin cambios de dependencias externas; posibles value objects (IncidentPeriod, ReliabilityTier)
application/    → 4 casos de uso nuevos, listados arriba
infrastructure/ → implementar get_checks_for_service en service_repository.py
interfaces/     → 3 endpoints nuevos (@action sobre ServiceViewSet, mismo patrón que ping/history)
frontend/       → 3 componentes nuevos en ServiceDetailPage (ReliabilityBadge, IncidentsList, TrendPanel)
```

## Fuera de scope (explícito)

- No se toca `docker-compose.prod.yml` ni producción desplegada
- No se reemplaza el filtrado de `CheckResultViewSet` (ya resuelto correctamente por ORM/índices)
- No se usan librerías pesadas de ML — regresión manual (mismo criterio que `appresso-algoritmos`)
- No se despliega nada hasta confirmación explícita

## Auditoría del resto del código

Se revisó el resto del backend/frontend buscando otros candidatos reales a búsqueda binaria/estructuras eficientes, fuera de los 4 puntos ya definidos:

- `get_consecutive_failures()` (`infrastructure/repositories/service_repository.py`): itera manualmente con `break` sobre un slice ya acotado a 20 filas. Es el único otro caso de iteración manual sobre queryset, pero al estar acotado a O(20) no justifica binary search — mencionado, no se toca.
- Bloqueo de IPs (`middleware.py`, `BlockedIPModel`): lookup por columna `unique=True`, resuelto por índice B-tree de Postgres. No tocar.
- `ConfigManager`: dict lookup O(1) sobre JSON en memoria. Su problema real es I/O (relee/reescribe el archivo entero en cada llamada), no de algoritmo de búsqueda — fuera de scope de este plan.
- Paginación: 100% DRF (`PageNumberPagination`), sin loops manuales.
- Frontend (`ServiceDetailPage.jsx` — `ServiceHistoryTable`): hace `filter()+sort()` en cliente sobre historial acotado a 50 filas. Intrascendente a este volumen, pero es el caso de estudio más limpio si se quiere justificar por qué el backend (bisección en punto 2) es la ubicación correcta para el algoritmo y no el cliente.

Conclusión: no aparecieron candidatos adicionales con sustancia. Los 4 puntos del plan siguen siendo el scope completo.

## Entorno de desarrollo

Trabajo en clon local (`C:\Users\SEBAS\Desktop\Sentinel`), branch nueva, `.env` local con credenciales dummy (no las de producción), `docker compose up --build` local para validar. Producción sigue corriendo sin tocarse.
