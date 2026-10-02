# Detección de Anomalías en Transacciones (Ventana Deslizante)

Sesión de trabajo — 2026-10-02.

## Resumen

Se **reemplazó** el sistema de membresías / `UsageEvent` por un dominio de
**transacciones financieras**, para cumplir el enunciado: ingesta vía POST,
orden cronológico, ventana deslizante por usuario, límite configurable por
franja horaria, validación de hash SHA-256, registro de anomalías y
dashboard con estadísticas.

## Decisiones de diseño

- **Migración completa**: `UsageEvent`/`Plan`/`Subscription` eliminados y
  sustituidos por `Transaction`, `TransactionAnomaly` y `DetectionConfig`.
- **Hash**: `SHA-256( "idTxn|user|date|value|paymentMethod" )`. Se valida en
  cada ingesta contra los campos crudos del payload.
- **Endpoint POST público** (`AllowAny`) — el `user` viaja en el payload.
- **Regla**: ventana fija configurable (segundos) + **límite por franja
  horaria**:
  - Mañana (05:00–12:00): 10
  - Tarde-noche (12:00–20:00): 6
  - Noche-madrugada (20:00–05:00): 3

  > Nota: con estos límites por defecto, "3 transacciones en 3s" sólo es
  > anomalía en franja noche. Para reproducir el ejemplo del enunciado en
  > horario mañana, bajar `morning_limit` vía `/detection-config/`.

## Backend

### Dominio
- `domain/entities/transaction.py` — `Transaction`, `TransactionAnomaly`, `DetectionConfig`.
- `domain/interfaces/transaction_repository.py` — puerto `ITransactionRepository`.

### Aplicación (casos de uso)
- `transaction_hash.py` — cálculo y validación SHA-256.
- `time_band.py` — clasificación de franja y resolución de umbral.
- `detect_transaction_anomalies.py` — ventana deslizante (2 punteros) por
  usuario, orden cronológico, nivel (low/medium/high) y valor total.
- `ingest_transactions.py` — orquesta validación, descarte de duplicados,
  persistencia y detección.
- `calculate_transaction_stats.py` / `calculate_transaction_trends.py` —
  métricas del dashboard.

### Infraestructura
- `infrastructure/models.py` — `DetectionConfigModel`, `TransactionModel`,
  `TransactionAnomalyModel` (se quitaron los modelos de membresías y el
  signal de suscripción por defecto).
- `infrastructure/repositories/transaction_repository.py` — repo Django.
- `infrastructure/migrations/0011_transactions_replace_membership.py`.

### Interfaces HTTP
- `TransactionIngestView` (POST `/api/v1/transactions/`, público) — acepta
  una transacción o una lista; responde `accepted`, `rejected`, `anomalies_detected`.
- `TransactionAnomalyViewSet` (`/transaction-anomalies/`, admin) — list/retrieve/patch
  + acciones `stats`, `trends`, `timeline`.
- `DetectionConfigView` (GET/PUT `/detection-config/`, admin).

## Frontend
- `useAnomalyDashboard.js` — apunta a `/transaction-anomalies/`.
- `AnomalyStatCards.jsx` — agrega **valor sospechoso** y métricas de transacciones.
- `AnomalyBreakdown.jsx` (nuevo) — **anomalías por nivel** y **métodos de pago**.
- `AnomalyTable.jsx` — columnas de valor y nivel.
- `AnomalyTimelineModal.jsx` — línea de tiempo sobre la ventana real.
- `AnomalyTrendChart.jsx`, `i18n.js` — terminología de transacciones (ES/EN).

## Validación
- `pytest`: **63 pasan** (unitarios + integración).
- `ruff check` sobre los archivos nuevos: limpio.
- `npm run build` (frontend): OK.
- `makemigrations --check`: sin cambios pendientes.

## Pendiente / posibles mejoras
- La detección corre sobre el **lote recibido** en cada POST; una ráfaga
  partida entre dos requests no se cruzaría. Si se requiere, extender a
  considerar transacciones recientes almacenadas por usuario.
- No hay UI para editar `DetectionConfig` (el endpoint existe, falta pantalla).
