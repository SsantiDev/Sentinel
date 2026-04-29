# CLAUDE.md — Sentinel (Backend)

## Project Overview

**Name:** Sentinel Monitor  
**Type:** REST API + Background Worker  
**Purpose:** Monitoreo automatizado de servicios y APIs — health checks, alertas, observabilidad

---

## Stack

**Runtime:** Python 3.12  
**Framework:** Django 5 + Django REST Framework  
**Database:** PostgreSQL 16  
**ORM:** Django ORM  
**Auth:** JWT (djangorestframework-simplejwt)  
**Queue/Cache:** Redis + Celery + Celery Beat  
**Key libs:** django-environ, gunicorn, psycopg2-binary, requests

---

## Architecture — Clean Architecture

```
sentinel/
├── domain/
│   ├── entities/        # Service, CheckResult, Alert — pure Python
│   └── interfaces/      # IServiceRepository, IAlertNotifier
├── application/
│   ├── use_cases/       # ping_service.py, create_service.py, send_alert.py
│   └── services/        # alert_service.py, health_service.py
├── infrastructure/
│   ├── repositories/    # Django ORM implementations
│   ├── external/        # HTTP ping client, email/slack notifiers
│   └── tasks/           # Celery tasks (thin wrappers over use cases)
├── interfaces/
│   ├── http/
│   │   ├── views/       # DRF ViewSets (no logic)
│   │   └── serializers/ # Request/response DTOs
│   └── workers/         # Celery Beat schedule config
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── local.py
│   │   └── production.py
│   ├── urls.py
│   └── celery.py
├── tests/
│   ├── unit/
│   └── integration/
├── docker-compose.yml
└── nginx/
```

---

## Key Commands

```bash
# Dev server
python manage.py runserver

# Celery worker
celery -A config worker -l info

# Celery Beat
celery -A config beat -l info

# Migrations
python manage.py makemigrations
python manage.py migrate

# Tests
pytest

# Lint
ruff check .

# Docker
docker compose up --build
docker compose down
```

---

## API Conventions

- **Base path:** `/api/v1/`
- **Auth:** `Authorization: Bearer <token>`
- **Error format:** `{ "error": "MESSAGE", "code": "SNAKE_CASE" }`
- **Dates:** ISO 8601, UTC

---

## DO NOT

- No logic in views — use cases only
- No `infrastructure/` imports from `application/`
- No secrets in code — `.env` only
- No file > 400 lines
