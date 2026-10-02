# 6. Contrato para el bot evaluador

Esta es la "ficha técnica" que necesita un evaluador automático (o cualquier
cliente) para enviar transacciones y validar el comportamiento.

## El endpoint

```
POST /api/v1/transactions/
```

- **Abierto**: no requiere autenticación ni token.
- `Content-Type: application/json`.
- Acepta **una** transacción (objeto) o **un lote** (lista de objetos).

## Formato de una transacción

```json
{
  "idTxn": 10001,
  "user": "aa@aa.com",
  "date": "2026-09-23T10:30:01.120",
  "value": 50000,
  "paymentMethod": "Tarjeta",
  "hash": "ec37a3a3..."
}
```

| Campo | Tipo | Nota |
|---|---|---|
| `idTxn` | entero | único; si se repite, se rechaza como `DUPLICATE` |
| `user` | correo | identifica la ventana del usuario |
| `date` | texto ISO 8601 | con o sin zona horaria |
| `value` | número | monto |
| `paymentMethod` | texto | Tarjeta, Efectivo, Transferencia, PSE, Otro |
| `hash` | texto | SHA-256 (ver abajo) |

## Cómo se calcula el hash (clave para que el bot acierte)

El hash es el **SHA-256** del texto de los campos unidos con `|` en este orden:

```
idTxn|user|date|value|paymentMethod
```

El servidor lo recalcula tomando **exactamente el texto** que viene en el JSON.
Para evitar diferencias por decimales, **envía `value` como entero** (o como
texto) y usa esa misma representación al calcular el hash.

### Reproducirlo en Python (idéntico al servidor)

```python
import hashlib

def compute_hash(id_txn, user, date, value, payment_method):
    message = f"{id_txn}|{user}|{date}|{value}|{payment_method}"
    return hashlib.sha256(message.encode("utf-8")).hexdigest()

h = compute_hash(10001, "aa@aa.com", "2026-09-23T10:30:01.120", 50000, "Tarjeta")
# -> úsalo como el campo "hash"
```

> Regla práctica: el texto que pongas en `value` dentro del JSON debe ser el
> mismo que uses para calcular el hash. Con enteros (p. ej. `50000`) no hay
> ambigüedad.

## Respuesta del endpoint

Siempre responde `201 Created` con un resumen:

```json
{
  "accepted": 3,
  "rejected": [
    { "idTxn": 20, "reason": "INVALID_HASH" }
  ],
  "anomalies_detected": 1
}
```

- `accepted`: cuántas se guardaron.
- `rejected`: las descartadas y por qué (`INVALID_PAYLOAD`, `INVALID_HASH`, `DUPLICATE`).
- `anomalies_detected`: cuántas anomalías generó este lote.

### Otros códigos

| Situación | Código HTTP | `code` |
|---|---|---|
| Cuerpo no es objeto ni lista | 400 | `INVALID_BODY` |
| Lote demasiado grande (>1000) | 413 | `BATCH_TOO_LARGE` |
| Demasiadas peticiones | 429 | (throttling) |

## Ejemplos listos para copiar

### Caso NORMAL (transacciones separadas)
```bash
curl -s -X POST http://localhost:8000/api/v1/transactions/ \
  -H "Content-Type: application/json" \
  -d '[
    {"idTxn":1,"user":"c@c.com","date":"2026-09-23T10:00:01","value":100,"paymentMethod":"Tarjeta","hash":"<HASH_1>"},
    {"idTxn":2,"user":"c@c.com","date":"2026-09-23T10:00:10","value":100,"paymentMethod":"Tarjeta","hash":"<HASH_2>"}
  ]'
# Esperado: "anomalies_detected": 0
```

### Caso ANÓMALO (3 seguidas de noche → límite 3)
```bash
curl -s -X POST http://localhost:8000/api/v1/transactions/ \
  -H "Content-Type: application/json" \
  -d '[
    {"idTxn":10,"user":"b@b.com","date":"2026-09-23T21:00:01","value":50000,"paymentMethod":"Tarjeta","hash":"<HASH_10>"},
    {"idTxn":11,"user":"b@b.com","date":"2026-09-23T21:00:02","value":50000,"paymentMethod":"Tarjeta","hash":"<HASH_11>"},
    {"idTxn":12,"user":"b@b.com","date":"2026-09-23T21:00:03","value":50000,"paymentMethod":"Tarjeta","hash":"<HASH_12>"}
  ]'
# Esperado: "anomalies_detected": 1
```

Reemplaza `<HASH_n>` por el resultado de `compute_hash(...)` para cada fila.

## Configuración de la detección (opcional, requiere admin)

Si el evaluador necesita otros límites o ventana:

```
GET  /api/v1/detection-config/      (admin)
PUT  /api/v1/detection-config/      (admin)
     { "window_seconds": 3, "morning_limit": 10,
       "afternoon_limit": 6, "night_limit": 3 }
```

Útil, por ejemplo, para bajar `morning_limit` a 3 y reproducir el "3 en 3s"
del enunciado en horario de mañana.
