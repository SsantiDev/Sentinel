# Sentinel Monitor — Documentación técnica completa

## Qué es

Sentinel es un sistema de monitoreo automatizado de servicios web y APIs, multi-tenant (cada servicio pertenece a un usuario). Cada `check_interval_seconds` (default 60s) hace un HTTP GET a las URLs registradas por el usuario, guarda el resultado (status, latencia, código HTTP), y si detecta caída dispara alertas configurables. Además, sobre el historial acumulado de checks corre un motor analítico propio con 4 algoritmos clásicos (búsqueda binaria, bisección recursiva, progresión aritmética, regresión lineal) para responder preguntas como "¿cuánto uptime tuvo este mes?", "¿desde cuándo está caído?" o "¿se está poniendo lento y en cuánto tiempo cruza el umbral crítico?".

No es un pinger simple: es un producto con registro de usuarios (email + OTP), planes con límites (trial), multi-tenancy, y un panel con gráficos de tendencia.

---

## Arquitectura general

```
┌─────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE                        │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │  nginx   │───▶│   web    │───▶│   PostgreSQL 16  │   │
│  │ 80/443   │    │ Django+  │    │                  │   │
│  └──────────┘    │  DRF     │    └──────────────────┘   │
│                  └────┬─────┘                            │
│                       │                                   │
│                  ┌────▼─────┐    ┌──────────────────┐   │
│                  │  Redis   │◀───│  Celery Worker   │   │
│                  │ (cola +  │    │  (pings, emails) │   │
│                  │  cache   │◀───│  Celery Beat     │   │
│                  │  OTP)    │    │  (dispara c/60s) │   │
│                  └──────────┘    └──────────────────┘   │
└─────────────────────────────────────────────────────────┘

Frontend (React + Vite) corre aparte, fuera de Docker en desarrollo,
consume la API via nginx/Django con proxy /api en vite.config.js.
```

Redis cumple doble rol: **cola de tareas** (Celery) y **cache de OTP** (códigos de verificación con TTL, no se persisten en Postgres).

---

## Stack — Backend

| Capa | Tecnología |
|---|---|
| Runtime | Python 3.12 |
| Framework | Django 5 + Django REST Framework |
| Base de datos | PostgreSQL 16 |
| ORM | Django ORM |
| Auth | JWT (`djangorestframework-simplejwt`) + flujo propio de registro con OTP |
| Cola / cache | Redis + Celery + Celery Beat |
| Servidor WSGI | Gunicorn |
| Libs clave | django-environ, psycopg2-binary, requests |
| Testing | pytest, pytest-django, pytest-cov |
| Lint | ruff |

### Capas (Clean Architecture)

```
domain/          Entidades puras, cero dependencias externas
                   Service, CheckResult, Alert, AlertRule (dataclasses)
                   ServiceStats, IncidentPeriod, LatencyTrend (DTOs de analytics)
                   OTPToken (email, code, purpose: 'register' | 'reset')
                 Interfaces/contratos: IServiceRepository, IAlertNotifier, etc.

application/     use_cases/ — funciones puras de lógica de negocio, reciben
                 repositorios/notificadores por inyección de dependencia:
                   ping_service.py        → orquesta un ping completo
                   send_alert.py          → arma y despacha una alerta
                   create_service.py      → alta de servicio
                   register_user.py       → alta de usuario + disparo de OTP
                   verify_email.py        → valida OTP, activa user, emite JWT
                   resend_verification.py
                   forgot_password.py / reset_password.py
                   calculate_service_stats.py   → algoritmo 1 (búsqueda binaria)
                   find_incident_start.py       → algoritmo 2 (bisección recursiva)
                   calculate_reliability_tier.py→ algoritmo 3 (progresión aritmética)
                   predict_latency_trend.py     → algoritmo 4 (regresión lineal)

infrastructure/  Implementaciones reales:
                   models.py              → ORM Django (detalle abajo)
                   repositories/          → implementan las interfaces de domain/
                   otp_repository.py      → OTP en Redis (cache), no en DB
                   external/http_client.py     → HTTP GET real a los servicios
                   external/alert_notifier.py  → Log / Email / Slack / Composite
                   tasks/ping_tasks.py    → tareas Celery de ping
                   tasks/email_tasks.py   → tareas Celery de envío de email (OTP, alertas)
                   config_manager.py

interfaces/      Entrada/salida del sistema:
                   http/views/            → ViewSets DRF (service_views.py, auth_views.py)
                   http/serializers/
                   http/urls.py           → rutas /api/v1/
                   workers/               → entrypoints de Celery
```

Regla de dependencia (documentada en `CLAUDE.md` del proyecto): `infrastructure/` nunca importa de `application/`; toda la lógica de negocio vive en use cases, nunca en las vistas.

---

## Stack — Frontend

| Aspecto | Tecnología |
|---|---|
| Framework | React 19.2.5 |
| Build tool | Vite 8.0.10 |
| Routing | react-router-dom 7.14.2 |
| HTTP client | axios 1.15.2 (instancia centralizada, no fetch nativo) |
| Estilos | Tailwind CSS v4 (plugin nativo de Vite, no PostCSS clásico) + tailwind-merge + clsx |
| Animaciones | framer-motion 12.38.0 |
| Gráficos | recharts 3.8.1 |
| i18n | i18next + react-i18next |
| Iconos | lucide-react |
| Lint | ESLint 10 (flat config) |

**Manejo de estado:** no hay Redux/Zustand ni store global de datos. El patrón es "custom hook como capa de aplicación": cada dominio de datos tiene su hook bajo `application/hooks/` (`useServices`, `useAlerts`, `useHistory`, `useLimits`, `useServiceAnalytics`, `useServiceDetail`, `useSettings`, `useAuth`) que encapsula las llamadas a `infrastructure/apiClient` y expone estado + funciones a las páginas. El único estado transversal real es `ThemeContext` (dark/light, persistido en `localStorage`).

### Clean Architecture también en frontend

```
domain/          types.js — JSDoc typedefs puros (Service, CheckResult), sin lógica
application/     hooks/ (casos de uso del frontend) + context/ThemeContext.jsx
infrastructure/  apiClient.js (axios + interceptores), authStorage.js (JWT en
                 localStorage), i18n.js, utils.js
presentation/    components/ (ServiceCard, StatusBadge, LatencyChart,
                 IncidentBanner, ReliabilityBadge...) y pages/ (una por ruta:
                 DashboardPage, ServiceDetailPage, RegisterPage,
                 VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage,
                 AdminUsersPage...)
```

`apiClient.js`: baseURL `/api/v1`, interceptor de request inyecta `Authorization: Bearer <token>`, interceptor de response hace logout automático + redirect a `/login` ante un 401.

`authStorage.js`: decodifica el payload del JWT sin verificar firma (solo para leer `exp`/`is_staff`/`is_superuser` en cliente) y maneja una "expiración efectiva" propia (`sentinel_effective_exp`) separada del `exp` real del token — soporta un límite de sesión de plan trial (`TRIAL_SESSION_MINUTES` en backend), vigilado en UI por `SessionTimer`/`SessionWatcher`.

---

## Infraestructura / Docker

5 contenedores vía `docker-compose.yml`:

| Contenedor | Rol | Puerto |
|---|---|---|
| `web` | API REST + Django Admin (Gunicorn) | 8000 |
| `worker` | Ejecuta pings y envío de emails en background | — |
| `beat` | Dispara `schedule_all_pings` cada 60s | — |
| `db` | PostgreSQL | 5432 |
| `redis` | Cola de tareas Celery + cache de OTP | 6379 |

`nginx/default.conf` hace de reverse proxy delante de `web`. `docker-compose.prod.yml` separado para producción. Frontend no corre en Docker en desarrollo (Vite standalone en `:5173` con proxy a `:8000`); en producción se buildea a `frontend/dist/` y lo sirve nginx o un contenedor propio (`frontend/Dockerfile`).

---

## Flujo completo de un ping

```
Celery Beat (cada 60s)
       │
       ▼
schedule_all_pings()          Obtiene todos los servicios activos de la DB
       │
       ▼ (por cada servicio)
ping_service_task(service_id) Tarea Celery encolada en Redis
       │
       ▼
ping_service(id, repo, notifier)  Use case puro
       │
       ├── repo.get_by_id(id)
       ├── ping_url(url) → HTTP GET real
       │       ├── 200-399 → status: UP
       │       └── 400+/excepción → status: DOWN
       ├── repo.save_check_result(result)
       └── si DOWN → send_alert()
               ├── LogAlertNotifier    → logger.warning
               ├── EmailAlertNotifier  → SMTP (si configurado)
               └── SlackAlertNotifier  → webhook POST (si configurado)
```

`AlertRuleModel` permite condiciones configurables por servicio: `consecutive_failures` o `latency_above` con un `threshold`, canal (`email` por ahora) y contacto destino — no toda caída dispara alerta automáticamente, depende de las reglas configuradas.

---

## Flujo de autenticación (registro + OTP + JWT)

El OTP **no se guarda en PostgreSQL, vive en Redis** (cache), TTL de 900s (15 min). Clave: `otp:{purpose}:{email_lower}`. Código numérico de 6 dígitos. `purpose` es `'register'` o `'reset'`.

**Registro** (`POST /auth/register/` → `register_user.py`):
1. Valida el body. Si el username ya existe → error. Si el email existe y `is_active=True` → error "ya registrado". Si existe pero `is_active=False` (registro pendiente sin verificar) → reusa ese user.
2. Crea el `User` con `is_active=False`.
3. Genera OTP, lo guarda en Redis, dispara `send_otp_email.delay(...)` — tarea Celery asíncrona (el envío de email no bloquea el request HTTP).
4. El worker arma un email HTML (dígitos estilizados) vía `EmailMultiAlternatives`.

**Verificación** (`POST /auth/verify-email/` → `verify_email.py`):
1. Compara el código recibido contra el guardado en cache; si expiró o no coincide → error.
2. Activa el `User` (`is_active=True`), borra el OTP de cache.
3. **Emite JWT directamente en esta respuesta** (`RefreshToken.for_user(user)`, con claims custom `username`/`is_staff`) — verificar el código loguea automáticamente, sin login separado después.

**Reenvío** (`POST /auth/resend-verification/`): mismo patrón, respuesta silenciosa si el email no existe o ya está activo (no filtra qué emails están registrados).

**Recuperación de contraseña** (`forgot_password.py` / `reset_password.py`): mismo mecanismo de OTP con `purpose='reset'`. `forgot_password` también es silencioso ante email inexistente.

**Login normal** (sesiones posteriores): `POST /auth/token/`, endpoint estándar de `simplejwt` (no es un use case custom), username/password → `{access, refresh}`. El frontend guarda `access` en `localStorage` vía `authStorage`.

Existe además `BlockedIPModel` (`ip_address`, `attempts`, `is_blocked`, `blocked_at`) — mecanismo de bloqueo por IP, probablemente contra fuerza bruta en login/OTP.

---

## El motor analítico (4 algoritmos)

Todo corre sobre `CheckResult` acumulados, se dispara desde `ServiceDetailPage` (hook `useServiceAnalytics`, 3 requests en paralelo con `Promise.all`). Ninguna ventana de cálculo depende del volumen histórico total (todas son constantes acotadas 50–500), así que no degradan con el tiempo — el cuello de botella real es la query a Postgres, mitigada con un índice compuesto `(service, -checked_at)`.

1. **Búsqueda binaria** — `GET /services/{id}/stats/` (`calculate_service_stats.py`). Uptime%, latencia promedio y p95 sobre una ventana de los últimos 500 checks. Con `?at=<timestamp>` usa búsqueda binaria (`find_check_by_timestamp_binary`) para ubicar el estado del servicio en un momento puntual del pasado.

2. **Recursión por bisección** — `GET /services/{id}/incidents/` (`find_incident_start.py`). Responde "¿desde cuándo está caído?": función recursiva `_bisect_incident_start` que parte a la mitad una ventana de 200 checks hasta encontrar el primer check DOWN de la racha actual.

3. **Progresión aritmética** — sin endpoint propio, dentro de `calculate_reliability_tier.py`. Genera escalones equiespaciados (80, 85, 90, 95 por defecto) para clasificar el uptime% en tiers: Bronze / Silver / Gold / Platinum.

4. **Regresión lineal** — `GET /services/{id}/trend/` (`predict_latency_trend.py`). Ventana de 50 checks, pendiente e intercepto por mínimos cuadrados sobre la latencia, proyecta en cuántos checks futuros se cruzaría el `critical_ms` configurable (default 2000ms, editable desde el frontend). Graficado con `recharts` en `LatencyChart.jsx`.

Documentación teórica extendida de estos mismos 4 algoritmos vive en `docs/` (`ALGORITMOS_APLICADOS.md`, `TEORIA_ALGORITMOS.md`, `BACKEND_ALGORITMOS_LINEA_POR_LINEA.md`, `FRONTEND_LINEA_POR_LINEA.md`, `GUIA_SIMPLE_ALGORITMOS.md`, `FUNCIONES_Y_OPERACIONES_ALGORITMOS.md`, `FLUJO_ALGORITMOS.md`, `PLAN_ALGORITMOS.md`, `PRUEBA_ALGORITMOS.md`, `GUIA_TESTS_ESCALABILIDAD.md`, `TESTS_Y_ESCALABILIDAD_ALGORITMOS.md`) con distinto nivel de profundidad, útil si se necesita el detalle matemático o la justificación de complejidad algorítmica.

---

## Modelo de datos

**Modelos Django** (`infrastructure/models.py`):

- **`ServiceModel`** — `owner` (FK a `User`, nullable, multi-tenant), `name`, `url`, `check_interval_seconds` (default 60), `is_active`.
- **`CheckResultModel`** — FK a `ServiceModel` (`related_name='checks'`), `status` (up/down/unknown), `response_time_ms`, `status_code`, `error_message`, `checked_at` (auto_now_add). `ordering = ['-checked_at']`, índice compuesto `(service, -checked_at)`.
- **`AlertRuleModel`** — FK a `ServiceModel` (`related_name='alert_rules'`), `condition` (`consecutive_failures` | `latency_above`), `threshold`, `channel` (`email` por ahora), `contact`, `is_active`.
- **`UserProfileModel`** — OneToOne con `User` (`related_name='sentinel_profile'`), `emails_sent` (contador para límite de plan trial). Se autocrea vía signal `post_save` sobre `User`.
- **`BlockedIPModel`** — `ip_address` (único), `attempts`, `is_blocked`, `blocked_at`.

**Entidades de dominio** (`domain/entities/`, dataclasses puras, no todas persisten en DB):

- `service.py` — `Service`, `CheckResult`, `Alert`, `AlertRule` (reflejan los modelos ORM).
- `analytics.py` — `ServiceStats`, `IncidentPeriod`, `LatencyTrend`: DTOs de salida de los algoritmos, calculados al vuelo, nunca persistidos.
- `otp_token.py` — `OTPToken` (email, code, purpose), vive en Redis vía `otp_repository.py`, no en Postgres.

---

## Endpoints de la API (`/api/v1/`)

| Método | URL | Descripción | Auth |
|---|---|---|---|
| POST | `/auth/register/` | Alta de usuario, dispara OTP por email | No |
| POST | `/auth/verify-email/` | Valida OTP, activa cuenta, devuelve JWT | No |
| POST | `/auth/resend-verification/` | Reenvía OTP de registro | No |
| POST | `/auth/forgot-password/` | Dispara OTP de reseteo | No |
| POST | `/auth/reset-password/` | Valida OTP, cambia contraseña | No |
| POST | `/auth/token/` | Login estándar simplejwt | No |
| POST | `/auth/token/refresh/` | Renueva access token | No |
| GET/POST | `/services/` | Listar / crear servicios | Sí |
| GET/PUT/DELETE | `/services/{id}/` | Ver / editar / eliminar servicio | Sí |
| POST | `/services/{id}/ping/` | Forzar ping manual | Sí |
| GET | `/services/{id}/history/` | Historial de checks | Sí |
| GET | `/services/{id}/stats/` | Uptime%, latencia (algoritmo 1) | Sí |
| GET | `/services/{id}/incidents/` | Inicio de incidente actual (algoritmo 2) | Sí |
| GET | `/services/{id}/trend/` | Tendencia de latencia (algoritmo 4) | Sí |

Error format estándar: `{ "error": "MESSAGE", "code": "SNAKE_CASE" }`. Fechas en ISO 8601 UTC.

---

## Testing

Backend: pytest + pytest-django + pytest-cov, tests unitarios sin DB ni HTTP real (repositorios y notificadores mockeados/in-memory).

| Archivo | Qué verifica |
|---|---|
| `test_ping_service.py` | Guarda resultados, alerta si DOWN, no alerta si UP, error si servicio no existe |
| `test_send_alert.py` | Se llama al notificador correcto, mensaje contiene el nombre del servicio |
| `test_http_client.py` | HTTP 200 = UP, HTTP 500 = DOWN, ConnectionError = DOWN con mensaje de error |

Comandos: `pytest tests/unit/ -v`, con cobertura `--cov=.`.

---

## Convenciones y reglas del proyecto (de `CLAUDE.md`)

- Sin lógica de negocio en las vistas — solo use cases.
- `infrastructure/` nunca importa de `application/`.
- Sin secretos en código — todo vía `.env`.
- Ningún archivo mayor a 400 líneas.
- Base path de API: `/api/v1/`. Auth por header `Authorization: Bearer <token>`.
