# 11 — Mapa de archivos: ¿dónde vive cada cosa?

Índice de ubicaciones del sistema de transacciones: validación, hash, endpoint
público, detección, logs, dashboard y configuración.

> **Rutas:** se citan por **archivo + función + línea** (`archivo:línea`). Líneas
> al día de la sesión 2026-10-08. Si algo no cuadra, el nombre de la función es
> el ancla estable. Para preguntas de defensa con respuesta, ver
> `DEFENSA_TECNICA.md`.

Ruta base: `backend/`.

---

## Resumen de una mirada

| Qué quiero ver | Archivo : línea | Pieza |
|---|---|---|
| Validar una transacción (3 filtros) | `application/use_cases/ingest_transactions.py:88-132`, `:135-248` | `_parse_one`, `ingest_transactions` |
| Límites anti-500 (tamaños de columna) | `application/use_cases/ingest_transactions.py:57-75` | `_ensure_db_bounds` |
| Armar y verificar el hash | `application/use_cases/transaction_hash.py:5-29`, `:32-43` | `compute_transaction_hash`, `is_valid_hash` |
| Endpoint público de ingesta | `interfaces/http/views/transaction_views.py:72-141` | `TransactionIngestView` |
| Simulador (firma en el servidor) | `interfaces/http/views/transaction_views.py:144-183` | `TransactionSimulateView` |
| Detectar anomalías (ventanas no solapadas) | `application/use_cases/detect_transaction_anomalies.py:31-96`, `:99-126` | `_detect_for_user`, `detect_transaction_anomalies` |
| Franjas horarias y límites | `application/use_cases/time_band.py:9-42` | `get_time_band`, `threshold_for_band` |
| Dónde se guardan txns y anomalías | `infrastructure/models.py:150-211` | `TransactionModel`, `TransactionAnomalyModel` |
| Logs a archivo (ingesta y rechazos) | `interfaces/http/views/transaction_views.py:121-141` | log `sentinel.ingest` |
| Pantalla de Registros (solo admin) | `interfaces/http/views/log_views.py` | `LogTailView` → `/logs` |
| Rutas / URLs | `interfaces/http/urls.py:24,33,34,35` | ingesta, simulador, anomalías, config |
| Clave, throttle y tope de lote | `config/settings/base.py:18,126,130` | secret, throttle, max lote |
| Modo seguro para exponer (DEBUG off) | `config/settings/tunnel.py` | settings del túnel |
| Tablero de anomalías | `frontend/src/presentation/pages/AnomalyDashboardPage.jsx` | usa `useAnomalyDashboard` |

---

## 1. Validación de la transacción

**Archivo:** `application/use_cases/ingest_transactions.py`

Tres **filtros en orden**, dentro de `ingest_transactions` (`:135-248`):

1. **Formato** — `_parse_one` (`:88-132`) convierte el dato crudo en transacción.
   Rechaza campos faltantes, tipos inválidos (incluidos booleanos disfrazados de
   número, `:101-104`), números/fechas no válidos y usuario/método vacíos. Motivo
   `INVALID_PAYLOAD`.
2. **Firma** — `is_valid_hash` (`:179-192`). Si no coincide, motivo `INVALID_HASH`.
   Solo si la firma es obligatoria (modo laboratorio la omite).
3. **Duplicado** — por `idTxn`, en el lote (`:196-201`) y en la base (`:202-207`).
   Motivo `DUPLICATE`.

Además, antes de guardar se **acotan los tamaños** a lo que cabe en cada columna
(`_ensure_db_bounds`, `:57-75`), porque el guardado en bloque se salta la
validación de Django. Así un monto gigante o un texto larguísimo se rechaza
limpio (422) en vez de reventar en la base (500).

> El endpoint público **no** usa `TransactionInputSerializer`; la estructura la
> valida `_parse_one` a mano. El serializer de entrada existe pero no se conecta
> a este camino.

El tope de lote, el tipo de cuerpo y el código de respuesta (400 / 413 / 201 /
422) se deciden en la vista `TransactionIngestView` y en `_ingest_response`
(`interfaces/http/views/transaction_views.py:47-69`, `:88-107`).

---

## 2. El hash (firma HMAC-SHA256)

**Archivo:** `application/use_cases/transaction_hash.py`

- `compute_transaction_hash` (`:5-29`) arma el mensaje uniendo los campos en
  orden fijo (`idTxn | user | date | value | paymentMethod`, línea `:24`) y lo
  firma con **HMAC-SHA256** (`:25-29`) usando la clave secreta.
- `is_valid_hash` (`:32-43`) recalcula y compara en **tiempo constante**
  (`hmac.compare_digest`, `:43`).

La clave **no** está en este archivo: se lee de la configuración
(`TRANSACTIONS_HMAC_SECRET`, `config/settings/base.py:18`, que viene del `.env`).
Que la firma sea obligatoria o no es configurable en vivo
(`TRANSACTIONS_REQUIRE_SIGNATURE`, `base.py:26`; se controla por usuario admin).

> **Estado actual:** la firma está **DESACTIVADA** para el bot/evaluador
> (`require_signature=False`), porque el bot no comparte la clave. En ese modo el
> hash **se recibe pero no se valida**; las transacciones entran por formato +
> anti-duplicado. El Filtro 2 solo corre si la firma está activa
> (`ingest_transactions.py:176-179`). El simulador sí firma (clave en el servidor).

---

## 3. El endpoint público y los demás

**Archivos:** `interfaces/http/views/transaction_views.py` · rutas en
`interfaces/http/urls.py`

| Ruta | Clase | Quién entra |
|---|---|---|
| `POST /api/v1/transactions/` | `TransactionIngestView` (`:72-141`) | Cualquiera (público) |
| `POST /api/v1/transactions/simulate/` | `TransactionSimulateView` (`:144-183`) | Autenticado |
| `GET/PATCH /api/v1/transaction-anomalies/…` | `TransactionAnomalyViewSet` (`:186-233`) | Administrador |
| `GET/PUT /api/v1/detection-config/` | `DetectionConfigView` (`:236-268`) | Super administrador |

El público es abierto a propósito (para un bot evaluador). La protección no es el
login, sino: **firma** (`:85-86` throttle y `:114-118` firma), **límite de
peticiones por IP** (`:85-86`) y **tope de lote** (`:102-107`). Al exponerlo por
túnel se usa el modo seguro `config/settings/tunnel.py` (DEBUG apagado).

---

## 4. Detección de anomalías

**Archivos:** `application/use_cases/detect_transaction_anomalies.py` y
`application/use_cases/time_band.py`

- `detect_transaction_anomalies` (`:99-126`) agrupa por usuario y ordena por fecha.
- `_detect_for_user` (`:31-96`) usa **ventanas NO solapadas**: desde la primera
  transacción sin consumir abre una ventana de `window` segundos; si las que caen
  dentro alcanzan el límite de la franja, el grupo es **una** anomalía y continúa
  después de la última (sin reportar dos veces). Una ráfaga larga se reparte en
  varias ventanas (ya **no** se colapsa en una sola).
- `_severity_level` (`:11-28`) da el nivel por `count/threshold`: `>=2` alto,
  `>=1.5` medio, resto bajo.

Se dispara desde `ingest_transactions` (`:217-243`) tras guardar, corriendo
contra el **historial** del usuario (no solo el lote), con anti-doble-reporte de
ráfagas (`exists_overlapping_anomaly`, `transaction_repository.py:87-98`).

---

## 5. Logs: dónde queda el registro

Hay registro en **tres lugares** (desde la sesión del visor de logs):

1. **Archivo rotativo** `backend/logs/sentinel.log` — se escribe con el logger
   `sentinel.ingest` en la vista: por cada petición, IP real + aceptadas /
   rechazadas / anomalías (`transaction_views.py:121-128`); por cada rechazo, su
   motivo y detalle (`:130-141`). Configuración del logger:
   `config/settings/logging_config.py` (enganchado en `base.py:138`).
   Se consulta desde la pantalla **Registros** (`/logs`, solo admin) vía
   `interfaces/http/views/log_views.py` (`LogTailView`).
2. **La base de datos** — `infrastructure/models.py`: las transacciones y las
   anomalías (`TransactionAnomalyModel`, `:179-211`): usuario, cuántas, ventana,
   franja, nivel, valor total, inicio/fin, estado y `detected_at`.
3. **La respuesta de cada ingesta** — aceptadas, rechazadas y el motivo de cada
   rechazo (`INVALID_PAYLOAD` / `INVALID_HASH` / `DUPLICATE`).

> Regla: los logs van a **archivo**, nunca a una tabla de la base.

El acceso a datos pasa por `infrastructure/repositories/transaction_repository.py`
(`DjangoTransactionRepository`).

---

## 6. El dashboard

**Frontend:**
- `frontend/src/presentation/pages/AnomalyDashboardPage.jsx` — el tablero
  (resumen, tendencias, mapa de calor por hora, lista y detalle de anomalías).
- `frontend/src/application/hooks/useAnomalyDashboard.js` — pide `stats`, `trends`
  y la lista de anomalías.
- `frontend/src/presentation/pages/TransactionSimulatorPage.jsx` — el simulador.

Los datos salen de `TransactionAnomalyViewSet`: `.../stats/`
(`transaction_views.py:196-199`), `.../trends/` (`:202-206`) y
`.../{id}/timeline/` (`:209-233`). Los `stats` se derivan de conteos crudos en
`infrastructure/repositories/transaction_metrics.py:26-142` (no inventan nada).

---

## 7. Configuración y seguridad

**Archivo:** `config/settings/base.py` (y perfiles `local.py`, `production.py`,
`tunnel.py`)

- `TRANSACTIONS_HMAC_SECRET` (`:18`) — clave de firma, del `.env`.
- `TRANSACTIONS_REQUIRE_SIGNATURE` (`:26`) — valor inicial del interruptor de
  firma (luego vive en la base, editable por admin; se siembra en
  `transaction_repository.py:37-40`).
- `DEFAULT_THROTTLE_RATES['transactions_ingest']` = `3000/min` (`:126`).
- `MAX_TRANSACTIONS_PER_REQUEST` = `1000` (`:130`) — supera → 413.
- `TRANSACTIONS_RESET_UNTIL` (`:32`) — fecha hasta la que la tarea de reseteo
  horario borra datos; pasada esa fecha se auto-apaga
  (`infrastructure/tasks/transaction_tasks.py:23-40`).
- `EXCEPTION_HANDLER` (`:132`) → `config/exception_handler.py:8-30` registra los
  5xx sin filtrar la traza al cliente.
- Modo túnel: `config/settings/tunnel.py` (`DEBUG=False`, hosts `*`) para exponer
  sin filtrar internals.

---

## 8. Pruebas (tests)

- `backend/tests/unit/test_transaction_hash.py` — la firma.
- `backend/tests/unit/test_detect_transaction_anomalies.py` — la detección por
  ventanas (incluye el reparto de una ráfaga larga en varias anomalías).
- `backend/tests/unit/test_calculate_transaction_stats.py` — los stats del tablero.
- `backend/tests/integration/test_transaction_views.py` — el endpoint de punta a
  punta (incluye rechazo limpio de entradas extremas, sin 500).

> Los tests corren en Docker; el entorno local puede estar incompleto.
