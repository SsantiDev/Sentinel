# Algoritmos aplicados en Sentinel

Documento de trazabilidad: dónde vive cada uno de los 4 algoritmos requeridos, por qué se eligió ese lugar del dominio (monitoreo de uptime, no el dominio de café de `appresso-algoritmos`), y su complejidad. Ver `docs/PLAN_ALGORITMOS.md` para el plan previo a la implementación.

---

## 1. Búsqueda (binaria vs lineal) + estadísticas

**Dónde:** `backend/application/use_cases/calculate_service_stats.py`
**Expuesto en:** `GET /api/v1/services/{id}/stats/` (`backend/interfaces/http/views/service_views.py`, método `stats`)

**Qué hace:** calcula uptime %, latencia promedio y p95 sobre el historial real de `CheckResultModel` de un servicio. Si se pasa `?at=<timestamp>`, busca el check más cercano a ese instante usando búsqueda binaria (`find_check_by_timestamp_binary`) sobre la lista ordenada ascendente por `checked_at`.

**Por qué acá:** Sentinel ya resuelve el filtrado normal vía índices de Postgres (`CheckResultViewSet`) — no tenía sentido reimplementar eso. El punto de valor real es que no existía ninguna vista agregada de calidad de servicio (uptime %, p95) ni forma de ubicar un check puntual en el tiempo; ambas cosas requiere el dashboard para mostrar "¿qué pasó a las 14:32?" sin traer todo el historial al cliente.

**Complejidad:**
- Binaria: mejor caso O(1) (match exacto en el primer punto medio), peor caso O(log n).
- Lineal (`find_check_by_timestamp_linear`, incluida como referencia comparativa en `tests/unit/test_calculate_service_stats.py`): mejor caso O(1), peor caso O(n).
- Test `test_binary_and_linear_search_agree_on_result` verifica que ambas coinciden en el resultado y que la binaria usa menos operaciones.

---

## 2. Recursión (divide y vencer) — inicio de incidente

**Dónde:** `backend/application/use_cases/find_incident_start.py`
**Expuesto en:** `GET /api/v1/services/{id}/incidents/`

**Qué hace:** si el último check de un servicio está `DOWN`, encuentra recursivamente (bisección) el primer check de la racha continua de caídas — es decir, cuándo empezó el incidente activo — en vez de recorrer el historial linealmente desde el final.

**Por qué acá:** Sentinel registra cada ping individual pero no calculaba "desde cuándo" algo está caído; era información implícita en la tabla `check_results`, nunca derivada. Es feature real para el dashboard/alertas, no cosmética.

**Precondición del algoritmo:** la racha `DOWN` debe ser continua hasta el último check (sin altibajos intermedios) — válido porque se busca el incidente activo actual, no histórico arbitrario.

**Complejidad:** O(log n), profundidad de recursión = log2(n). Verificado en `tests/unit/test_find_incident_start.py::test_operations_count_is_logarithmic` (16 elementos → ≤5 operaciones vs 16 de un escaneo lineal).

---

## 3. Progresión aritmética — tiers de confiabilidad

**Dónde:** `backend/application/use_cases/calculate_reliability_tier.py`
**Expuesto en:** incluido en la respuesta de `stats/` (campo `reliability_tier`), sin endpoint propio — decisión del plan original para no duplicar superficie de API.

**Qué hace:** genera n umbrales de uptime % mediante progresión aritmética (`a1`, `a1+d`, `a1+2d`, ...) y clasifica el servicio en el tier más alto que cumple (`Bronze/Silver/Gold/Platinum` por defecto). `a1`, `d`, `n` son siempre parámetros de la función — nunca hardcodeados, mismo criterio que exige el `CLAUDE.md` de `appresso-algoritmos` para los umbrales 42/72/120.

**Por qué acá (reinterpretación explícita):** el algoritmo original pensado para "fidelización de clientes" no tiene equivalente literal en Sentinel (no hay clientes). Se reinterpreta como niveles de confiabilidad de servicio — mismo mecanismo matemático (progresión aritmética generando umbrales), dominio distinto. Esto se decidió explícitamente en la conversación de planeamiento, no es un mapeo forzado silencioso.

**Complejidad:** O(n) sobre la cantidad de tiers (típicamente 4), irrelevante en la práctica.

---

## 4. Regresión lineal — predicción de degradación

**Dónde:** `backend/application/use_cases/predict_latency_trend.py`
**Expuesto en:** `GET /api/v1/services/{id}/trend/?critical_ms=<umbral>`

**Qué hace:** ajusta una regresión lineal manual (mínimos cuadrados, sin librerías de ML) sobre `response_time_ms` de los últimos N checks. Si la pendiente es positiva (latencia subiendo), calcula en cuántos checks más se cruzaría el umbral crítico pasado por parámetro.

**Por qué acá:** hoy Sentinel solo alerta reactivamente (`consecutive_failures`, `latency_above` ya ocurrido). Esto agrega una alerta preventiva basada en tendencia — el mismo salto conceptual que "predicción de ventas" en `appresso-algoritmos`, pero aplicado a series de tiempo de latencia real en vez de pedidos simulados.

**Complejidad:** O(n) sobre la ventana de muestras (un recorrido para medias, otro para numerador/denominador de la pendiente).

---

## Capas tocadas (resumen)

```
domain/entities/service.py       → CheckResult gana campo id (Optional, default None)
domain/entities/analytics.py     → nuevo: ServiceStats, IncidentPeriod, LatencyTrend
domain/interfaces/service_repository.py → nuevo método get_checks_for_service
infrastructure/repositories/service_repository.py → implementación + _to_check_result_entity
application/use_cases/           → 4 archivos nuevos (uno por algoritmo)
interfaces/http/views/service_views.py → 3 endpoints nuevos (stats, incidents, trend)

frontend/src/application/hooks/useServiceAnalytics.js → fetch de stats/incidents/trend
frontend/src/presentation/components/ReliabilityBadge.jsx → tier junto a StatusBadge
frontend/src/presentation/components/IncidentBanner.jsx   → banner si active_incident
frontend/src/presentation/components/TrendIndicator.jsx   → card de tendencia en bento
frontend/src/presentation/pages/ServiceDetailPage.jsx     → integra los 3 componentes
frontend/src/infrastructure/i18n.js → claves nuevas bajo serviceDetail (es/en)
```

## Verificación

**Backend:**
- `docker compose exec web pytest -q`: 21 passed (los 4 casos de uso nuevos con 100% cobertura); 2 fallos preexistentes en `test_ping_service.py`/`test_send_alert.py` no relacionados (mensaje de alerta en español vs assert en inglés) — no se tocó ese código, quedan fuera de este scope.
- `docker compose exec web ruff check .`: 9 errores preexistentes, ninguno en archivos nuevos ni modificados de este trabajo.
- Smoke test end-to-end con JWT real: servicio creado, 23 checks sembrados (20 up con latencia ascendente 100→385ms, 3 down), los 3 endpoints devolvieron datos correctos y consistentes con lo sembrado (uptime 86.96% → tier Silver, incidente detectado en 5 operaciones, pendiente de regresión 15.0 ms/check exacta, breach proyectado en 8 checks). Datos de prueba eliminados tras verificar.

**Frontend:**
- `npm run build`: OK (warning de chunk size preexistente, no relacionado).
- `npm run lint`: 36 errores preexistentes en otros archivos (`LoginPage`, `SettingsPage`, `VerifyEmailPage`, imports sin usar en `ServiceDetailPage` ya presentes antes de este trabajo — confirmado con `git diff`). Cero errores en los 4 archivos nuevos.
- Dev server (`npm run dev` + proxy `/api` → backend local:8000) levantó sin errores de consola/compilación. **No se verificó visualmente en navegador** — este entorno no tiene herramienta de automatización de navegador disponible; la verificación se limitó a build/lint limpios y a que los datos que consume la UI (stats/incidents/trend) ya se confirmaron correctos contra el backend real.
