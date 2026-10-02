# 11 — Mapa de archivos: ¿dónde vive cada cosa?

Este documento es un **índice de ubicaciones**. Responde la pregunta
"¿esto en qué archivo está?" para el sistema de transacciones: validación,
hash, endpoint público, detección, dashboard, "logs" y configuración.

> **Nota sobre las rutas:** se citan por **archivo + nombre de función**, no por
> número de línea. El código se está comentando en paralelo y las líneas se
> mueven; el archivo y el nombre de la función se mantienen estables.

---

## Resumen de una mirada

| Qué quiero ver | Archivo | Pieza concreta |
|---|---|---|
| Cómo se valida una transacción | `backend/application/use_cases/ingest_transactions.py` | `_parse_one`, `ingest_transactions` |
| Cómo se arma y verifica el hash | `backend/application/use_cases/transaction_hash.py` | `compute_transaction_hash`, `is_valid_hash` |
| Validación de formato del simulador y de la config | `backend/interfaces/http/serializers/transaction_serializer.py` | `TransactionSimulateSerializer`, `DetectionConfigSerializer` |
| El endpoint público que recibe transacciones | `backend/interfaces/http/views/transaction_views.py` | `TransactionIngestView` |
| El simulador (genera y firma en el servidor) | `backend/interfaces/http/views/transaction_views.py` | `TransactionSimulateView` |
| Cómo se detecta una anomalía | `backend/application/use_cases/detect_transaction_anomalies.py` | `_detect_for_user`, `detect_transaction_anomalies` |
| Las franjas horarias y sus límites | `backend/application/use_cases/time_band.py` | `get_time_band`, `threshold_for_band` |
| Dónde se guardan transacciones y anomalías ("los logs") | `backend/infrastructure/models.py` | `TransactionAnomalyModel` (y el modelo de transacción) |
| Las rutas / URLs de la API | `backend/interfaces/http/urls.py` | `transactions/`, `transactions/simulate/`, `transaction-anomalies/`, `detection-config/` |
| La clave secreta, el límite de peticiones y el tope de lote | `backend/config/settings/base.py` | `TRANSACTIONS_HMAC_SECRET`, `DEFAULT_THROTTLE_RATES`, `MAX_TRANSACTIONS_PER_REQUEST` |
| El tablero donde se ven las anomalías | `frontend/src/presentation/pages/AnomalyDashboardPage.jsx` | usa el hook `useAnomalyDashboard` |
| La pantalla del simulador | `frontend/src/presentation/pages/TransactionSimulatorPage.jsx` | — |

---

## 1. Validación de la transacción

**Archivo:** `backend/application/use_cases/ingest_transactions.py`

La validación ocurre en **tres filtros en orden**, dentro de `ingest_transactions`:

1. **Formato** — `_parse_one` convierte el dato crudo en una transacción.
   Si falta un campo, un número no es número o la fecha es inválida, se
   descarta con motivo `INVALID_PAYLOAD`. Aquí también se rechaza usuario o
   método de pago vacíos.
2. **Firma** — `is_valid_hash` (del archivo del hash). Si la firma no coincide,
   se descarta con motivo `INVALID_HASH`.
3. **Duplicado** — `repo.id_txn_exists`. Si el `idTxn` ya existe, se descarta
   con motivo `DUPLICATE`.

> Importante: el endpoint público **no** usa `TransactionInputSerializer`. La
> validación de estructura la hace `_parse_one` a mano. El serializer de
> entrada existe pero no está conectado a ese camino.

El límite de tamaño del cuerpo, el tipo del cuerpo y el código de respuesta
(400 / 413 / 201 / 422) se deciden un nivel arriba, en la vista
`TransactionIngestView` y en el ayudante `_ingest_response`
(`backend/interfaces/http/views/transaction_views.py`).

---

## 2. El hash (firma HMAC-SHA256)

**Archivo:** `backend/application/use_cases/transaction_hash.py`

- `compute_transaction_hash` arma el mensaje uniendo los campos en orden fijo
  (`idTxn | user | date | value | paymentMethod`) separados por `|` y lo firma
  con **HMAC-SHA256** usando la clave secreta.
- `is_valid_hash` recalcula la firma y la compara contra la recibida en
  **tiempo constante** (`hmac.compare_digest`).

La clave secreta **no** está en este archivo: se lee de la configuración
(`TRANSACTIONS_HMAC_SECRET` en `base.py`, que a su vez viene del `.env`).

---

## 3. El endpoint público y los demás

**Archivo:** `backend/interfaces/http/views/transaction_views.py`
**Rutas:** `backend/interfaces/http/urls.py`

| Ruta | Clase | Quién puede entrar |
|---|---|---|
| `POST /api/v1/transactions/` | `TransactionIngestView` | Cualquiera (público) |
| `POST /api/v1/transactions/simulate/` | `TransactionSimulateView` | Usuario autenticado |
| `GET/PATCH /api/v1/transaction-anomalies/` | `TransactionAnomalyViewSet` | Administrador |
| `GET/PUT /api/v1/detection-config/` | `DetectionConfigView` | Super administrador |

El endpoint público es abierto a propósito (para que un bot evaluador mande un
flujo de transacciones). La protección no es el login, sino: la **firma**, el
**límite de peticiones por IP** y el **tope de tamaño de lote**.

---

## 4. Detección de anomalías

**Archivos:**
`backend/application/use_cases/detect_transaction_anomalies.py` y
`backend/application/use_cases/time_band.py`

- `detect_transaction_anomalies` agrupa por usuario y ordena por fecha.
- `_detect_for_user` corre una **ventana deslizante** (técnica de dos punteros)
  y marca ráfaga cuando, dentro de la ventana de tiempo, la cantidad de
  transacciones de ese usuario alcanza el límite de su franja horaria.
- `_severity_level` clasifica la gravedad en `high` / `medium` / `low`.

Esta detección se dispara automáticamente desde `ingest_transactions` después
de guardar las transacciones válidas.

---

## 5. "Los logs": dónde queda el registro

En este sistema **no hay un archivo de log tradicional** para el flujo de
transacciones (no se escribe a disco ni a un `logger`). El registro de lo que
pasó queda en dos lugares:

1. **La base de datos** — `backend/infrastructure/models.py`:
   - Las transacciones guardadas.
   - Las anomalías detectadas (`TransactionAnomalyModel`): usuario, cuántas
     transacciones, en qué ventana, qué franja, nivel de gravedad, valor total,
     inicio y fin de la ventana, estado y cuándo se detectó.
2. **La respuesta de cada ingesta** — lo que devuelve `POST /transactions/`:
   cuántas se aceptaron, cuáles se rechazaron y **el motivo** de cada rechazo
   (`INVALID_PAYLOAD`, `INVALID_HASH`, `DUPLICATE`).

El acceso a la base pasa por el repositorio
`backend/infrastructure/repositories/transaction_repository.py`
(`DjangoTransactionRepository`).

---

## 6. El dashboard (dónde se ve todo)

**Archivos (frontend):**
- `frontend/src/presentation/pages/AnomalyDashboardPage.jsx` — el tablero de
  anomalías. Muestra estadísticas, tendencias y la lista de anomalías, y
  permite ver la línea de tiempo de cada una.
- `frontend/src/application/hooks/useAnomalyDashboard.js` — el hook que pide los
  datos a la API (`stats`, `trends`, lista de anomalías, timeline).
- `frontend/src/presentation/pages/TransactionSimulatorPage.jsx` — la pantalla
  del simulador para generar transacciones de prueba.

Los datos que pinta el dashboard salen de los endpoints del
`TransactionAnomalyViewSet`: `.../transaction-anomalies/stats/`,
`.../trends/` y `.../{id}/timeline/`.

---

## 7. Configuración y seguridad

**Archivo:** `backend/config/settings/base.py`

- `TRANSACTIONS_HMAC_SECRET` — la clave con la que se firma y se verifica. Viene
  del `.env`. Su valor por defecto es vacío (ver advertencia en el documento de
  preguntas de examen).
- `DEFAULT_THROTTLE_RATES['transactions_ingest']` = `3000/min` — máximo de
  peticiones por IP al endpoint público (freno a inundación / DoS).
- `MAX_TRANSACTIONS_PER_REQUEST` = `1000` — máximo de transacciones por cuerpo
  (si se supera, responde 413).

---

## 8. Pruebas (tests)

- `backend/tests/unit/test_transaction_hash.py` — prueba la firma.
- `backend/tests/integration/test_transaction_views.py` — prueba el endpoint de
  ingesta de punta a punta.

> Recordatorio: los tests corren en Docker; el entorno local puede estar
> incompleto.
