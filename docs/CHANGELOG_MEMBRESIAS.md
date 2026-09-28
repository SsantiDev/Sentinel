# Sistema de Membresias y Deteccion de Anomalias

Ultima sesion de trabajo — 2026-09-27.

## Resumen

Se agrego un sistema de planes/suscripciones con deteccion de abuso de
cuota por ventana deslizante, mas un dashboard de administracion para
revisar las anomalias detectadas.

## Commits

1. `12a4a69` — **feat:** sistema de membresias con deteccion de anomalias por ventana deslizante
2. `0534b1e` — **feat:** dashboard de anomalias con estadisticas, tendencias y timeline
3. `eaca2a0` — **fix:** sirve frontend con nginx y corrige contexto de build en Dockerfile
4. `b613bdc` — **chore:** amplia permisos locales de Claude Code para tooling de testing

## Detalle por area

### Backend — Dominio y aplicacion
- `domain/entities/membership.py` — entidades `UsageEvent`, `UsageAnomaly`.
- `domain/interfaces/membership_repository.py` — puerto `IMembershipRepository`.
- `application/use_cases/record_usage_event.py` — registra evento, evalua ventana deslizante contra el plan del usuario, persiste anomalia si corresponde.
- `application/use_cases/check_sliding_window.py` — logica pura de deteccion (cuenta eventos en ventana vs threshold).
- `application/use_cases/calculate_anomaly_stats.py` — agrega conteos (hoy/semana/mes, tasa, usuarios afectados, promedio).
- `application/use_cases/calculate_anomaly_trends.py` — normaliza distribucion horaria (24h) y evolucion diaria (14 dias).

### Backend — Infraestructura
- `infrastructure/models.py` — `PlanModel`, `SubscriptionModel`, `UsageEventModel`, `UsageAnomalyModel` (+ signal que asigna plan free a usuario nuevo).
- `infrastructure/repositories/membership_repository.py` — implementacion Django del repositorio.
- `infrastructure/migrations/0009_membership_models.py` — tablas iniciales.
- `infrastructure/migrations/0010_usageanomalymodel_status.py` — agrega `status` (open/reviewed/discarded) a anomalias.
- `infrastructure/fixtures/plans.json` — planes semilla.

### Backend — Interfaces HTTP
- `interfaces/http/serializers/membership_serializer.py` — `PlanSerializer`, `UsageAnomalySerializer`.
- `interfaces/http/views/membership_views.py`:
  - `UsageEventView` (POST `/usage-events/`) — registra evento, responde 429 si excede cuota.
  - `SubscriptionMeView` (GET `/subscriptions/me/`) — estado de cuota del usuario actual.
  - `PlanViewSet` (`/plans/`) — solo lectura, admin.
  - `UsageAnomalyViewSet` (`/usage-anomalies/`) — list/retrieve/patch + acciones `stats`, `trends`, `timeline`.
- `interfaces/http/urls.py` — registra las rutas anteriores.

### Frontend
- `application/hooks/useAnomalyDashboard.js` — fetch de stats/trends/anomalias y mutacion de estado.
- `presentation/components/AnomalyStatCards.jsx`, `AnomalyHourlyChart.jsx`, `AnomalyTrendChart.jsx`, `AnomalyTable.jsx`, `AnomalyTimelineModal.jsx`.
- `presentation/pages/AnomalyDashboardPage.jsx` — pagina compuesta, ruta `/anomalies` (solo superuser).
- `App.jsx`, `Sidebar.jsx`, `infrastructure/i18n.js` — routing, item de menu, traducciones ES/EN.

### Infra
- `frontend/Dockerfile` — corrige rutas de build (contexto raiz del monorepo) y cambia imagen final de `alpine` (no servia nada) a `nginx:alpine` con `nginx/default.conf`.
- `docker-compose.yml` — nuevo servicio `nginx` expuesto en puerto 80, depende de `web`.

### Tests
- `tests/unit/test_check_sliding_window.py`
- `tests/unit/test_calculate_anomaly_stats.py`
- `tests/unit/test_calculate_anomaly_trends.py`
- `tests/integration/test_membership_views.py`
- `tests/integration/test_anomaly_dashboard_views.py`

## Pendiente / no cubierto en esta sesion

- No se corrio `pytest` completo ni `ruff check .` como cierre de esta sesion — validar antes de dar por cerrado el feature.
- No hay endpoint para gestionar planes desde el frontend (`PlanViewSet` es solo lectura, sin UI de administracion de planes).
