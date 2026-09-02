# Guía Completa — Sentinel Monitor

## ¿Qué es Sentinel?

Sentinel es un sistema de monitoreo automatizado de servicios web y APIs. Su trabajo es simple: cada 60 segundos, hace ping a cada servicio que registres (por ejemplo `https://google.com`) y verifica si está respondiendo correctamente. Si detecta que algo está caído, puede enviarte una alerta por email o Slack.

---

## Arquitectura del sistema

```
┌─────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE                        │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │  nginx   │───▶│   web    │───▶│   PostgreSQL DB  │  │
│  │ (puerto  │    │ (Django  │    │   (datos)        │  │
│  │  80/443) │    │  + DRF)  │    └──────────────────┘  │
│  └──────────┘    └────┬─────┘                           │
│                       │                                  │
│                  ┌────▼─────┐    ┌──────────────────┐  │
│                  │  Redis   │◀───│  Celery Worker   │  │
│                  │ (cola de │    │  (ejecuta pings) │  │
│                  │  tareas) │◀───│  Celery Beat     │  │
│                  └──────────┘    │  (dispara c/60s) │  │
│                                  └──────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Los 5 contenedores Docker

| Contenedor | Rol | Puerto |
|------------|-----|--------|
| `web` | API REST + Admin Django | 8000 |
| `worker` | Ejecuta los pings en background | — |
| `beat` | Dispara tareas cada 60 segundos | — |
| `db` | Base de datos PostgreSQL | 5432 |
| `redis` | Cola de mensajes entre beat/worker | 6379 |

### Capas de código (Clean Architecture)

```
domain/          ← Entidades puras: Service, CheckResult, Alert
                   No depende de nada externo

application/     ← Lógica de negocio: ping_service, send_alert
                   Solo conoce el dominio

infrastructure/  ← Implementaciones reales: DB, HTTP, Email, Slack
                   Models Django, repositorios, clientes HTTP

interfaces/      ← API REST (DRF ViewSets) y workers Celery
                   Entrada/salida del sistema
```

---

## Flujo completo de un ping

```
Celery Beat (cada 60s)
       │
       ▼
schedule_all_pings()          ← Obtiene todos los servicios activos de la DB
       │
       ▼ (por cada servicio)
ping_service_task(service_id) ← Tarea Celery encolada en Redis
       │
       ▼
ping_service(id, repo, notifier)  ← Use case puro
       │
       ├── repo.get_by_id(id)     ← Busca el servicio en PostgreSQL
       │
       ├── ping_url(url)          ← HTTP GET real al servicio
       │       │
       │       ├── 200-399 → status: UP
       │       └── 400+/error → status: DOWN
       │
       ├── repo.save_check_result(result) ← Guarda resultado en DB
       │
       └── si DOWN → send_alert()
               │
               ├── LogAlertNotifier    → logger.warning(...)
               ├── EmailAlertNotifier  → smtp email (si configurado)
               └── SlackAlertNotifier  → webhook POST (si configurado)
```

---

## Cómo levantar el sistema

### Requisitos previos
- Docker Desktop instalado y corriendo
- Archivo `backend/.env` configurado (copia `backend/.env.example`; los valores de `DATABASE_URL`/`REDIS_URL` ya apuntan a los servicios del compose, no hace falta tocarlos para desarrollo local — solo generar un `SECRET_KEY` propio)
- Node.js 22+ instalado (para el frontend, que **no** corre dentro de Docker en desarrollo)

### Comandos — Backend (Docker)

```bash
# Levantar todo (primera vez o tras cambios en Dockerfile/deps)
docker compose up -d --build

# Primera vez únicamente: crear el schema de la base de datos
docker compose exec web python manage.py migrate

# Verificar que todos los contenedores están healthy
docker compose ps

# Ver logs en tiempo real
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs beat --tail=30
docker compose logs worker --tail=30
docker compose logs web --tail=30

# Bajar todo (la DB en el volumen sentinel_postgres_data no se borra)
docker compose down

# Bajar y borrar volúmenes (esto sí borra la DB)
docker compose down -v
```

### Comandos — Frontend (terminal aparte, sin Docker)

```bash
cd frontend
npm install   # solo la primera vez
npm run dev
```

Vite corre en `http://localhost:5173` con proxy automático `/api` → `http://localhost:8000` (config en `vite.config.js`), así que el backend de Docker debe estar arriba primero.

### Desarrollo local sin credenciales SMTP

El `.env.example` trae `SMTP_USER`/`SMTP_PASSWORD` vacíos — sin eso, el registro por email (código OTP) **no llega**, la tarea Celery falla en `worker`. Para desarrollar sin configurar SMTP real, creá un superusuario directo y saltate el flujo de registro/verificación:

```bash
docker compose exec web python manage.py createsuperuser
```

Con esas credenciales logueás directo en `http://localhost:5173/login`. El usuario queda en el volumen `sentinel_postgres_data`, sobrevive a reinicios de los contenedores.

### Estado esperado al levantar

```
NAME                STATUS
sentinel-web-1      Up (healthy)
sentinel-worker-1   Up
sentinel-beat-1     Up
sentinel-db-1       Up (healthy)
sentinel-redis-1    Up (healthy)
```

---

## Prueba manual completa paso a paso

### Paso 1 — Verificar que el servidor responde

Abre el navegador y ve a:
- **Admin:** http://localhost:8000/admin/
  - Usuario: `admin`
  - Password: la que configuraste

Deberías ver el panel oscuro de Django Admin.

### Paso 2 — Obtener un token JWT

```bash
curl -X POST http://localhost:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "TU_PASSWORD"}'
```

Respuesta esperada:
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Guarda el valor de `access` — lo necesitas para las siguientes llamadas.

### Paso 3 — Crear un servicio a monitorear

```bash
TOKEN="eyJ..."

curl -X POST http://localhost:8000/api/v1/services/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Google",
    "url": "https://google.com",
    "check_interval": 60
  }'
```

Respuesta esperada:
```json
{
  "id": 1,
  "name": "Google",
  "url": "https://google.com",
  "check_interval_seconds": 60,
  "is_active": true,
  "created_at": "2026-04-29T16:05:07Z"
}
```

### Paso 4 — Listar servicios registrados

```bash
curl http://localhost:8000/api/v1/services/ \
  -H "Authorization: Bearer $TOKEN"
```

### Paso 5 — Forzar un ping manual

```bash
curl -X POST http://localhost:8000/api/v1/services/1/ping/ \
  -H "Authorization: Bearer $TOKEN"
```

Respuesta:
```json
{"status": "ping queued"}
```

Esto encola el ping en Redis y el worker lo ejecuta en segundos.

### Paso 6 — Ver historial de pings

```bash
curl http://localhost:8000/api/v1/services/1/history/ \
  -H "Authorization: Bearer $TOKEN"
```

Respuesta esperada:
```json
[
  {
    "id": 1,
    "service": 1,
    "status": "up",
    "response_time_ms": 627.84,
    "status_code": 200,
    "error_message": null,
    "checked_at": "2026-04-29T16:05:13Z"
  }
]
```

### Paso 7 — Probar una alerta (simular caída)

Crea un servicio con una URL que no existe:

```bash
curl -X POST http://localhost:8000/api/v1/services/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Servicio Caído",
    "url": "https://esto-no-existe-123456.com",
    "check_interval": 60
  }'
```

Luego fuerza el ping (usa el id que devolvió la respuesta anterior):
```bash
curl -X POST http://localhost:8000/api/v1/services/2/ping/ \
  -H "Authorization: Bearer $TOKEN"
```

Verifica en los logs del worker que apareció la alerta:
```bash
docker compose logs worker --tail=20
```

Deberías ver algo como:
```
WARNING ALERT service_id=2: [DOWN] Servicio Caído (https://esto-no-existe-123456.com) — ...
```

### Paso 8 — Verificar Celery Beat automático

```bash
docker compose logs beat --tail=10
```

Salida esperada (una línea por minuto):
```
beat-1  | Scheduler: Sending due task schedule-all-pings-every-minute
beat-1  | Scheduler: Sending due task schedule-all-pings-every-minute
```

---

## Endpoints de la API

| Método | URL | Descripción | Auth |
|--------|-----|-------------|------|
| POST | `/api/v1/auth/token/` | Obtener JWT | No |
| POST | `/api/v1/auth/token/refresh/` | Renovar JWT | No |
| GET | `/api/v1/services/` | Listar servicios | Sí |
| POST | `/api/v1/services/` | Crear servicio | Sí |
| GET | `/api/v1/services/{id}/` | Ver servicio | Sí |
| PUT | `/api/v1/services/{id}/` | Editar servicio | Sí |
| DELETE | `/api/v1/services/{id}/` | Eliminar servicio | Sí |
| POST | `/api/v1/services/{id}/ping/` | Forzar ping | Sí |
| GET | `/api/v1/services/{id}/history/` | Ver historial | Sí |

---

## Configuración de alertas

### Email (Gmail como ejemplo)

En tu archivo `.env`:
```env
ALERT_EMAIL_FROM=sentinel@tudominio.com
ALERT_EMAIL_RECIPIENTS=tu@email.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@gmail.com
SMTP_PASSWORD=xxxx_xxxx_xxxx_xxxx
```

> Para Gmail: ve a Cuenta Google → Seguridad → Verificación en 2 pasos → Contraseñas de aplicación → Genera una para "Correo"

### Slack

1. Ve a https://api.slack.com/apps
2. Crea una app → "Incoming Webhooks" → actívalo
3. Copia la URL del webhook

En tu `.env`:
```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX
```

---

## Tests unitarios

```bash
# Correr todos los tests
docker compose exec web pytest tests/unit/ -v

# Con reporte de cobertura
docker compose exec web pytest tests/unit/ -v --cov=.

# Un test específico
docker compose exec web pytest tests/unit/test_ping_service.py -v
```

### Qué prueba cada archivo

| Archivo | Qué verifica |
|---------|-------------|
| `test_ping_service.py` | Use case principal: guarda resultados, alerta si DOWN, no alerta si UP, error si servicio no existe |
| `test_send_alert.py` | Que se llama al notificador y que el mensaje contiene el nombre del servicio |
| `test_http_client.py` | HTTP 200 = UP, HTTP 500 = DOWN, ConnectionError = DOWN con mensaje de error |

---

## Django Admin

Accede a http://localhost:8000/admin/ para:

- **Services** — crear/editar/eliminar servicios visualmente sin usar curl
- **Check Results** — ver historial completo de todos los pings con filtros
- Filtrar por estado (`up`/`down`), fecha, servicio

---

## Solución de problemas comunes

### El contenedor `web` no levanta

```bash
docker compose logs web --tail=50
```

Causas comunes:
- `.env` no existe o tiene variables vacías
- Puerto 8000 ocupado por otro proceso

### Los pings no aparecen en historial

```bash
docker compose logs worker --tail=20
```

Verificar que el worker está conectado a Redis y procesando tareas.

### Token JWT expirado

El `access` token expira en 5 minutos. Usa el `refresh` token:

```bash
curl -X POST http://localhost:8000/api/v1/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "eyJ..."}'
```

### Reiniciar un servicio específico

```bash
docker compose restart worker
docker compose restart beat
```

---

## Estructura de archivos clave

```
Sentinel/
├── domain/
│   ├── entities/service.py          # Service, CheckResult, Alert (clases puras)
│   └── interfaces/                  # Contratos: IServiceRepository, IAlertNotifier
├── application/
│   └── use_cases/
│       ├── ping_service.py          # ← Lógica central del sistema
│       ├── send_alert.py            # Construye y envía alertas
│       └── create_service.py        # Crea un servicio nuevo
├── infrastructure/
│   ├── models.py                    # ServiceModel, CheckResultModel (Django ORM)
│   ├── repositories/                # Implementación real de IServiceRepository
│   ├── external/
│   │   ├── http_client.py           # Hace el HTTP GET real
│   │   └── alert_notifier.py        # Email, Slack, Log, Composite
│   └── tasks/ping_tasks.py          # Tareas Celery
├── interfaces/
│   └── http/
│       ├── views/service_views.py   # API endpoints (DRF ViewSet)
│       ├── serializers/             # Serialización JSON
│       └── urls.py                  # Rutas /api/v1/
├── config/
│   ├── settings/base.py             # Configuración Django
│   ├── urls.py                      # URLs raíz + JWT
│   └── celery.py                    # App Celery
├── tests/unit/                      # 10 tests, sin DB ni HTTP real
├── docker-compose.yml               # 5 servicios
├── Dockerfile                       # Imagen Python 3.12
└── .env.example                     # Variables requeridas
```
