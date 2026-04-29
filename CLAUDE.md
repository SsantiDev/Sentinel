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

## Architecture — Monorepo Structure

```
sentinel/
├── backend/             # Django & Celery logic
│   ├── domain/          # Entities & repository interfaces
│   ├── application/     # Use cases
│   ├── infrastructure/  # DB, External APIs, Celery tasks
│   ├── interfaces/      # HTTP APIs (DRF)
│   ├── config/          # Settings & Celery config
│   ├── tests/           # Unit & integration tests
│   ├── Dockerfile
│   └── manage.py
├── frontend/            # React + Vite application
├── docker-compose.yml   # Global orchestration
└── nginx/               # Reverse proxy
```

---

## Key Commands

### Backend
```bash
cd backend
python manage.py runserver
celery -A config worker -l info
celery -A config beat -l info
python manage.py migrate
pytest
```

### Frontend
```bash
cd frontend
npm run dev
```

### Docker (Global)
```bash
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
