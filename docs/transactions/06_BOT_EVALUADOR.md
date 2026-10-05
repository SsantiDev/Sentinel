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
| `hash` | texto | huella de integridad; debe venir presente (ver abajo) |

## Sobre el campo `hash` (dos modos)

El sistema tiene dos modos. Un super administrador los cambia **en vivo** desde
el panel de configuración de detección (la variable `TRANSACTIONS_REQUIRE_SIGNATURE`
solo fija el valor inicial):

- **Modo laboratorio / evaluador (por defecto).** La firma **NO es
  obligatoria**. El servidor valida el **formato** de cada transacción y
  descarta la basura (campos faltantes, tipos inválidos, fechas imposibles),
  pero una transacción **bien formada se acepta aunque su `hash` no coincida**.
  Así, un evaluador externo que **no comparte la clave secreta** puede enviar su
  flujo y las anomalías se detectan igual. El campo `hash` debe venir, pero su
  valor no se verifica.

- **Modo producción (`TRANSACTIONS_REQUIRE_SIGNATURE=True`).** Se exige una
  **firma HMAC-SHA256** con una clave secreta compartida, para impedir que un
  tercero falsifique transacciones. La fórmula es:

  ```
  hmac_sha256( SECRET, "idTxn|user|date|value|paymentMethod" )
  ```

  La clave `SECRET` es la variable `TRANSACTIONS_HMAC_SECRET` del servidor y se
  entrega junto con la URL. El servidor recalcula la firma tomando
  **exactamente el texto** que viene en el JSON; para evitar diferencias por
  decimales, envía `value` como entero y usa esa misma representación al firmar.

### Firmar en Python (solo si el modo producción está activo)

```python
import hashlib
import hmac

SECRET = "<la clave que te entregan junto con la URL>"

def compute_hash(id_txn, user, date, value, payment_method):
    message = f"{id_txn}|{user}|{date}|{value}|{payment_method}"
    return hmac.new(SECRET.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()

h = compute_hash(10001, "aa@aa.com", "2026-09-23T10:30:01.120", 50000, "Tarjeta")
# -> úsalo como el campo "hash"
```

> En modo laboratorio puedes poner cualquier texto en `hash`; lo que decide la
> aceptación es que **los datos sean válidos**.

## Respuesta del endpoint

Responde con un resumen del procesamiento:

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

### Códigos HTTP

| Situación | Código HTTP | `code` |
|---|---|---|
| Se aceptó al menos una transacción | 201 | — |
| Cuerpo válido pero NO se aceptó ninguna (todas rechazadas) | 422 | — |
| Cuerpo no es objeto ni lista | 400 | `INVALID_BODY` |
| Lote demasiado grande (>1000) | 413 | `BATCH_TOO_LARGE` |
| Demasiadas peticiones (límite por IP) | 429 | (throttling) |

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

En modo producción, reemplaza `<HASH_n>` por el resultado de `compute_hash(...)`
para cada fila. En modo laboratorio (por defecto) puedes dejar cualquier texto.

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
