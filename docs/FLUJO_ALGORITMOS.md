# Flujo de los algoritmos aplicados en Sentinel

Complementa `docs/ALGORITMOS_APLICADOS.md` (qué y por qué) y `docs/PLAN_ALGORITMOS.md` (plan). Este documento traza el **flujo completo request → response** de cada algoritmo: desde el click en el frontend hasta el cálculo puro en `application/use_cases/`, con archivo y ruta exacta en cada salto.

---

## Vista general — las 4 rutas comparten el mismo punto de entrada

```mermaid
flowchart LR
    U["Usuario<br/>ServiceDetailPage"] --> H["useServiceAnalytics.js<br/>frontend/src/application/hooks/"]
    H -->|GET stats/incidents/trend| API["apiClient.js<br/>frontend/src/infrastructure/"]
    API --> VS["ServiceViewSet<br/>backend/interfaces/http/views/service_views.py"]
    VS --> UC1["calculate_service_stats.py<br/>(búsqueda binaria)"]
    VS --> UC2["find_incident_start.py<br/>(recursión)"]
    VS --> UC3["predict_latency_trend.py<br/>(regresión lineal)"]
    UC1 -.contiene.-> UC4["calculate_reliability_tier.py<br/>(progresión aritmética)"]
    UC1 --> REPO["ServiceRepository.get_checks_for_service<br/>backend/infrastructure/repositories/service_repository.py"]
    UC2 --> REPO
    UC3 --> REPO
    REPO --> DB[("PostgreSQL<br/>CheckResultModel")]
```

Los 3 endpoints se piden en paralelo (`Promise.all`) desde un único hook, pero cada uno resuelve un algoritmo distinto en el backend. El tier (algoritmo 3) no tiene endpoint propio: viaja embebido en la respuesta de `stats/`.

---

## 1. Búsqueda binaria vs lineal + estadísticas

**Disparador:** carga de `ServiceDetailPage.jsx` → `useServiceAnalytics(id)` → `GET /api/v1/services/{id}/stats/`

```mermaid
sequenceDiagram
    participant FE as ServiceDetailPage.jsx
    participant Hook as useServiceAnalytics.js
    participant View as service_views.py :: stats()
    participant UC as calculate_service_stats.py
    participant Tier as calculate_reliability_tier.py
    participant Repo as service_repository.py
    participant DB as PostgreSQL

    FE->>Hook: mount / refetch
    Hook->>View: GET /services/{id}/stats/?at=<opcional>
    View->>Repo: get_checks_for_service(service_id)
    Repo->>DB: SELECT ... ORDER BY checked_at ASC
    DB-->>Repo: filas CheckResultModel
    Repo-->>View: List[CheckResult] (entidad de dominio)
    View->>UC: calculate_service_stats(checks, at=timestamp?)
    UC->>UC: uptime %, latencia promedio, p95
    alt query param ?at= presente
        UC->>UC: find_check_by_timestamp_binary(checks, at)
    end
    UC->>Tier: calculate_reliability_tier(uptime_pct, a1, d, n)
    Tier-->>UC: tier (Bronze/Silver/Gold/Platinum)
    UC-->>View: ServiceStats (entidad)
    View-->>Hook: 200 JSON {uptime, avg_latency, p95, reliability_tier, ...}
    Hook-->>FE: stats
    FE->>FE: ReliabilityBadge.jsx renderiza tier
```

**Archivos y rutas:**
- `frontend/src/presentation/pages/ServiceDetailPage.jsx`
- `frontend/src/application/hooks/useServiceAnalytics.js`
- `frontend/src/presentation/components/ReliabilityBadge.jsx`
- `backend/interfaces/http/views/service_views.py` → método `stats`
- `backend/application/use_cases/calculate_service_stats.py` → `calculate_service_stats`, `find_check_by_timestamp_binary`, `find_check_by_timestamp_linear` (referencia comparativa, solo test)
- `backend/application/use_cases/calculate_reliability_tier.py` (invocado desde adentro de este caso de uso)
- `backend/domain/interfaces/service_repository.py` → contrato `get_checks_for_service`
- `backend/infrastructure/repositories/service_repository.py` → implementación real
- `backend/domain/entities/analytics.py` → entidad `ServiceStats`
- Test: `backend/tests/unit/test_calculate_service_stats.py`

---

## 2. Recursión (bisección) — inicio de incidente

**Disparador:** mismo mount de `ServiceDetailPage.jsx` → `GET /api/v1/services/{id}/incidents/`

```mermaid
sequenceDiagram
    participant FE as ServiceDetailPage.jsx
    participant Hook as useServiceAnalytics.js
    participant View as service_views.py :: incidents()
    participant UC as find_incident_start.py
    participant Repo as service_repository.py
    participant DB as PostgreSQL

    FE->>Hook: mount / refetch
    Hook->>View: GET /services/{id}/incidents/
    View->>Repo: get_checks_for_service(service_id)
    Repo->>DB: SELECT ... ORDER BY checked_at ASC
    DB-->>Repo: filas
    Repo-->>View: List[CheckResult]
    View->>UC: find_incident_start(checks)
    alt último check != DOWN
        UC-->>View: active_incident = None
    else último check == DOWN
        UC->>UC: bisección recursiva (rango se divide a la mitad c/llamada)
        UC-->>View: IncidentPeriod(started_at, ...)
    end
    View-->>Hook: 200 JSON {active_incident: {...} | null}
    Hook-->>FE: incident
    FE->>FE: IncidentBanner.jsx se muestra solo si active_incident
```

**Archivos y rutas:**
- `backend/interfaces/http/views/service_views.py` → método `incidents`
- `backend/application/use_cases/find_incident_start.py` (recursivo, caso base + reducción de rango)
- `backend/domain/entities/analytics.py` → entidad `IncidentPeriod`
- `frontend/src/presentation/components/IncidentBanner.jsx`
- Test: `backend/tests/unit/test_find_incident_start.py` (incluye `test_operations_count_is_logarithmic`)

**Precondición:** racha `DOWN` continua hasta el último check (sin altibajos intermedios) — ver límite documentado en `docs/PRUEBA_ALGORITMOS.md` punto 2.

---

## 3. Progresión aritmética — tiers de confiabilidad

No tiene endpoint propio: se calcula **dentro** del flujo del algoritmo 1, como último paso antes de responder `stats/`.

```mermaid
flowchart TD
    A["calculate_service_stats.py<br/>ya calculó uptime_pct"] --> B["calculate_reliability_tier.py<br/>calculate_reliability_tier(uptime_pct, a1, d, n)"]
    B --> C["genera umbrales:<br/>a1, a1+d, a1+2d, ..., a1+(n-1)d"]
    C --> D["clasifica uptime_pct en<br/>el tier más alto que cumple"]
    D --> E["ServiceStats.reliability_tier<br/>viaja embebido en stats/"]
    E --> F["ReliabilityBadge.jsx<br/>frontend/src/presentation/components/"]
```

**Archivos y rutas:**
- `backend/application/use_cases/calculate_reliability_tier.py` — `a1`, `d`, `n` siempre parámetros de función, nunca hardcodeados
- Invocado desde `backend/application/use_cases/calculate_service_stats.py`
- Campo de salida: `ServiceStats.reliability_tier` en `backend/domain/entities/analytics.py`
- `frontend/src/presentation/components/ReliabilityBadge.jsx`

---

## 4. Regresión lineal — predicción de degradación

**Disparador:** mismo mount de `ServiceDetailPage.jsx` → `GET /api/v1/services/{id}/trend/?critical_ms=<umbral>`

```mermaid
sequenceDiagram
    participant FE as ServiceDetailPage.jsx
    participant Hook as useServiceAnalytics.js
    participant View as service_views.py :: trend()
    participant UC as predict_latency_trend.py
    participant Repo as service_repository.py
    participant DB as PostgreSQL

    FE->>Hook: mount / refetch
    Hook->>View: GET /services/{id}/trend/?critical_ms=...
    View->>Repo: get_checks_for_service(service_id)
    Repo->>DB: SELECT ... ORDER BY checked_at ASC (últimos N)
    DB-->>Repo: filas
    Repo-->>View: List[CheckResult]
    View->>UC: predict_latency_trend(checks, critical_ms)
    UC->>UC: medias de x (índice) e y (response_time_ms)
    UC->>UC: pendiente = Σ(x-x̄)(y-ȳ) / Σ(x-x̄)²  (mínimos cuadrados manual)
    alt pendiente > 0 (latencia sube)
        UC->>UC: proyecta checks restantes hasta cruzar critical_ms
    end
    UC-->>View: LatencyTrend(slope, projected_breach_in, ...)
    View-->>Hook: 200 JSON {slope, projected_breach_in, ...}
    Hook-->>FE: trend
    FE->>FE: TrendIndicator.jsx renderiza card
```

**Archivos y rutas:**
- `backend/interfaces/http/views/service_views.py` → método `trend`
- `backend/application/use_cases/predict_latency_trend.py`
- `backend/domain/entities/analytics.py` → entidad `LatencyTrend`
- `frontend/src/presentation/components/TrendIndicator.jsx`

---

## Capas atravesadas (Clean Architecture, dirección hacia adentro)

```mermaid
flowchart LR
    subgraph Frontend
        P["presentation/<br/>ServiceDetailPage.jsx + 3 componentes"]
        A["application/<br/>useServiceAnalytics.js"]
        I["infrastructure/<br/>apiClient.js"]
        P --> A --> I
    end
    I -->|HTTP JSON| V

    subgraph Backend
        V["interfaces/http/views/<br/>service_views.py"]
        U["application/use_cases/<br/>4 archivos, uno por algoritmo"]
        D["domain/<br/>entities/analytics.py, interfaces/service_repository.py"]
        F["infrastructure/repositories/<br/>service_repository.py"]
        V --> U
        U --> D
        F --> D
        V -.no importa.-> F
        U -.no importa.-> F
    end
    F --> DB[("PostgreSQL")]
```

`application/` depende solo de `domain/` (interfaces, nunca de la implementación en `infrastructure/`). La instancia concreta del repositorio se inyecta en `interfaces/http/views/service_views.py`, no dentro de los casos de uso.

---

## Resumen archivo por archivo

| Capa | Archivo | Rol |
|---|---|---|
| Frontend presentación | `frontend/src/presentation/pages/ServiceDetailPage.jsx` | integra los 3 componentes |
| Frontend presentación | `frontend/src/presentation/components/ReliabilityBadge.jsx` | algoritmo 3 |
| Frontend presentación | `frontend/src/presentation/components/IncidentBanner.jsx` | algoritmo 2 |
| Frontend presentación | `frontend/src/presentation/components/TrendIndicator.jsx` | algoritmo 4 |
| Frontend aplicación | `frontend/src/application/hooks/useServiceAnalytics.js` | fetch paralelo de los 3 endpoints |
| Frontend infraestructura | `frontend/src/infrastructure/apiClient.js` | cliente HTTP |
| Backend interfaces | `backend/interfaces/http/views/service_views.py` | endpoints `stats`, `incidents`, `trend` (`@action` sobre `ServiceViewSet`) |
| Backend aplicación | `backend/application/use_cases/calculate_service_stats.py` | algoritmo 1 (búsqueda binaria/lineal + estadísticas) |
| Backend aplicación | `backend/application/use_cases/find_incident_start.py` | algoritmo 2 (recursión/bisección) |
| Backend aplicación | `backend/application/use_cases/calculate_reliability_tier.py` | algoritmo 3 (progresión aritmética) |
| Backend aplicación | `backend/application/use_cases/predict_latency_trend.py` | algoritmo 4 (regresión lineal) |
| Backend dominio | `backend/domain/entities/analytics.py` | `ServiceStats`, `IncidentPeriod`, `LatencyTrend` |
| Backend dominio | `backend/domain/interfaces/service_repository.py` | contrato `get_checks_for_service` |
| Backend infraestructura | `backend/infrastructure/repositories/service_repository.py` | implementación del repositorio + `_to_check_result_entity` |
| Tests | `backend/tests/unit/test_calculate_service_stats.py` | valida algoritmo 1 |
| Tests | `backend/tests/unit/test_find_incident_start.py` | valida algoritmo 2 (`test_operations_count_is_logarithmic`) |

Ver `docs/ALGORITMOS_APLICADOS.md` para complejidad Big O de cada uno y `docs/PRUEBA_ALGORITMOS.md` para flujo de prueba manual paso a paso.
