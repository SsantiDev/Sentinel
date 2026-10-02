# 5. Seguridad

El enunciado pide un endpoint **abierto** (para que un bot lo evalúe) pero a la
vez **lo más seguro posible** frente a herramientas como OWASP ZAP o Burp
Suite. Aquí se explica cómo se concilian esas dos cosas y qué protege cada
medida.

## Lo primero: hash ≠ cifrado

Es la pregunta más común, así que seamos claros:

- **Hash (lo que usamos)** → garantiza **integridad**: detecta si alguien
  cambió el monto, el usuario o cualquier campo en el camino. No oculta los
  datos.
- **Cifrado** → garantiza **confidencialidad**: oculta los datos para que
  nadie los lea. En este sistema la confidencialidad la da el **transporte
  HTTPS/TLS** (el tráfico viaja cifrado entre el cliente y el servidor).

> Resumen: los datos **viajan cifrados por HTTPS** y además llevan un **hash
> que el backend recalcula y compara** para rechazar cualquier transacción
> alterada.

## Cómo se valida el hash

1. Cada transacción llega con su campo `hash`.
2. El backend **recalcula** el hash con los mismos datos:
   `SHA-256( "idTxn|user|date|value|paymentMethod" )`.
3. Compara el hash recibido con el recalculado usando una **comparación en
   tiempo constante** (`hmac.compare_digest`), que evita ataques de medición
   de tiempo (*timing attacks*).
4. Si no coinciden → la transacción se **rechaza** (`INVALID_HASH`) y **no** se
   guarda.

Código: `backend/application/use_cases/transaction_hash.py`.

## Por qué el endpoint es abierto (y por qué está bien)

El POST `/api/v1/transactions/` **no pide autenticación** a propósito: así una
evaluación automatizada puede enviarle datos sin credenciales. En cambio,
**todo el dashboard y la configuración sí exigen ser administrador**. O sea:
cualquiera puede *enviar* transacciones, pero solo un admin puede *ver* los
resultados y *cambiar* la configuración.

## Medidas contra escáneres (ZAP / Burp) y abuso

| Medida | Qué ataque mitiga | Dónde |
|---|---|---|
| **Throttling** (límite de peticiones) | Fuerza bruta / martilleo / DoS | `transactions_ingest: 600/min` en `settings/base.py` |
| **Límite de tamaño de lote** (máx. 1000) | Agotar memoria con un payload gigante | Vista de ingesta (responde `413`) |
| **Validación estricta de formato** | Entradas malformadas que tumben el servidor | Caso de uso de ingesta (responde `INVALID_PAYLOAD`, nunca error 500) |
| **Hash en tiempo constante** | *Timing attack* sobre la comparación | `transaction_hash.py` |
| **Errores genéricos con código** | Fuga de información interna | Respuestas tipo `{ "error": ..., "code": ... }` |
| **`X-Content-Type-Options: nosniff`** | MIME sniffing | `HardeningMiddleware` |
| **`Referrer-Policy: same-origin`** | Fuga de URLs por el referer | `HardeningMiddleware` |
| **`Permissions-Policy`** | Uso no deseado de cámara/micrófono/GPS | `HardeningMiddleware` |
| **`Content-Security-Policy` + `Cache-Control: no-store`** (en `/api/`) | Inyección de contenido / cacheo de datos | `HardeningMiddleware` |
| **`X-Frame-Options: DENY`** | Clickjacking | `settings/base.py` + middleware de Django |
| **HSTS** (en producción) | Downgrade a HTTP | `settings/production.py` |
| **`DEBUG = False`** (en producción) | Fuga de stack traces | `settings/production.py` |
| **Bloqueo por IP** | IPs abusivas ya marcadas | `HardeningMiddleware` (ya existía) |

## Cómo validar la seguridad tú mismo

### 1. Chequeo de despliegue de Django
```bash
cd backend
DJANGO_SETTINGS_MODULE=config.settings.production python manage.py check --deploy
```
Debe quedar **sin advertencias**, salvo la del `SECRET_KEY`: esa depende del
valor real en el `.env` de producción (debe ser largo y aleatorio, no el de
ejemplo). No es un problema de código.

### 2. Ver las cabeceras de seguridad
```bash
curl -i -X POST http://localhost:8000/api/v1/transactions/ \
  -H "Content-Type: application/json" -d '{}'
```
Fíjate en `X-Content-Type-Options`, `Referrer-Policy`, `Cache-Control`,
`Content-Security-Policy`.

### 3. Escaneo con OWASP ZAP (baseline)
Con la app corriendo:
```bash
# Requiere Docker
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://TU_HOST:8000/api/v1/transactions/
```
Las alertas típicas (cabeceras faltantes, cacheo, clickjacking) ya están
cubiertas por las medidas de la tabla.

## Lo que NO cubre (honestidad)

- El hash usa **SHA-256 público** (sin clave secreta). Garantiza integridad y
  es **reproducible por el bot evaluador**, pero no prueba *autenticidad* (no
  demuestra *quién* envió la transacción). Si se quisiera eso, se usaría
  **HMAC-SHA256 con una clave secreta** compartida — fácil de activar, pero
  obligaría a que el emisor conozca esa clave.
- Al ser un endpoint abierto, alguien podría enviar transacciones "basura" con
  hash válido. La integridad se mantiene, pero no hay control de *origen*. Es
  una consecuencia aceptada del requisito de endpoint abierto.
