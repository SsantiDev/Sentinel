# 5. Seguridad

El enunciado pide un endpoint **abierto** (para que un bot lo evalúe) pero a la
vez **lo más seguro posible** frente a herramientas como OWASP ZAP o Burp
Suite. Aquí se explica cómo se concilian esas dos cosas y qué protege cada
medida. Incluye las preguntas de seguridad que surgieron y el tema de memoria.

> Resultado del ensayo con un bot evaluador riguroso: **26/26 verificaciones
> pasan** (integridad, formato, límites, detección, evasión, concurrencia,
> métodos, cabeceras, control de acceso y códigos HTTP).

## Lo primero: hash ≠ cifrado ≠ firma

Es la confusión más común, así que seamos claros:

- **Hash** → garantiza **integridad**: detecta si alguien cambió un campo. No
  oculta datos ni prueba quién lo envió.
- **Cifrado** → garantiza **confidencialidad**: oculta los datos. Aquí lo da el
  **transporte HTTPS/TLS** (el tráfico viaja cifrado).
- **Firma con clave (HMAC)** → garantiza **autenticidad + integridad**: solo
  quien tiene la clave secreta puede producir una firma válida. **Esto es lo que
  usamos.**

## Cómo se firma y valida cada transacción (HMAC)

Al inicio el sistema usaba un hash SHA-256 **público** (sin clave). Problema: la
fórmula es pública, así que **cualquiera podía falsificar** una transacción
calculando el mismo hash. Se cerró ese hueco pasando a **HMAC-SHA256 con una
clave secreta**:

1. Emisor y servidor comparten una clave secreta (`TRANSACTIONS_HMAC_SECRET`).
2. El emisor firma: `hmac_sha256( SECRET, "idTxn|user|date|value|paymentMethod" )`
   y manda esa firma en el campo `hash`.
3. El servidor **recalcula** la firma con su copia de la clave y compara en
   **tiempo constante** (`hmac.compare_digest`, evita *timing attacks*).
4. Si no coinciden → se **rechaza** (`INVALID_HASH`) y **no** se guarda.

Sin la clave, **no se puede fabricar una firma válida** → no se puede
falsificar. La clave es **independiente de la `SECRET_KEY` de Django** (vive en
`.env`, se comparte solo con el emisor legítimo/bot y se puede **rotar** por
entorno sin afectar las sesiones de Django).

Código: `backend/application/use_cases/transaction_hash.py`.

## El endpoint es abierto, pero firmado

El POST `/api/v1/transactions/` **no pide login** (así el bot evalúa sin
credenciales), pero **solo acepta transacciones firmadas con la clave**. En
cambio, **todo el dashboard y la configuración exigen ser administrador**.
Cualquiera puede *intentar* enviar, pero solo con la clave *entra*, y solo un
admin puede *ver* resultados y *cambiar* la configuración.

El simulador del front **no firma en el navegador** (sería exponer la clave en
un cliente público): manda los parámetros a un acceso autenticado y **el
servidor firma** por él.

## Memoria: cómo se protege (y por qué no la pueden saturar)

Pregunta importante: ¿alguien puede dañar o agotar la memoria? Capas que lo
impiden:

| Capa | Qué evita |
|---|---|
| **Firma HMAC** | Un externo sin la clave **no puede insertar ni una transacción** → no puede acumular datos para inflar memoria ni base. Lo que mande se descarta barato. |
| **Límite de tamaño de cuerpo** (nginx `client_max_body_size 1m`) | Un payload gigante se **rechaza en el borde (413)** antes de cargarse en el backend. |
| **Tope de lote (máx. 1000)** | Un solo request no puede traer más de 1000 transacciones a procesar (`413 BATCH_TOO_LARGE`). |
| **Límite de peticiones** (`3000/min` por origen) | Inundación de requests. |
| **Procesamiento eficiente** | La detección es una ventana deslizante O(n) con inserción en bloque; prueba de escala: **200.000 transacciones en < 15 s**. |

Comprobado en vivo: un cuerpo de ~2 MB devuelve `413` sin llegar a procesarse.

## Medidas contra escáneres (ZAP / Burp) y abuso

| Medida | Qué ataque mitiga | Dónde |
|---|---|---|
| **Firma HMAC con clave** | Falsificación de transacciones | `transaction_hash.py` |
| **Throttling** (`transactions_ingest: 3000/min`) | Fuerza bruta / martilleo / DoS | `settings/base.py` + `ScopedRateThrottle` en la vista |
| **Límite de tamaño de lote** (máx. 1000) | Agotar memoria con muchos ítems | Vista de ingesta (`413`) |
| **Límite de tamaño de cuerpo** (1 MB) | Agotar memoria con un payload enorme | `nginx/default.conf` (`413` en el borde) |
| **Validación estricta de formato** | Entradas malformadas | Caso de uso (`INVALID_PAYLOAD`, nunca `500`) |
| **Comparación en tiempo constante** | *Timing attack* sobre la firma | `transaction_hash.py` |
| **Códigos HTTP correctos** | Respuestas ambiguas / fuga de info | `201/422/400/413/429` |
| **`X-Content-Type-Options: nosniff`** | MIME sniffing | `HardeningMiddleware` |
| **`Referrer-Policy: same-origin`** | Fuga de URLs por el referer | `HardeningMiddleware` |
| **`Content-Security-Policy` + `Cache-Control: no-store`** (en `/api/`) | Inyección / cacheo de datos | `HardeningMiddleware` |
| **`X-Frame-Options: DENY`** | Clickjacking | `settings/base.py` + middleware |
| **ORM parametrizado** | Inyección SQL | Django ORM (probado con payloads de inyección) |
| **Bloqueo por IP** | IPs abusivas marcadas | `HardeningMiddleware` |

## Códigos HTTP del endpoint

| Situación | Código |
|---|---|
| Se aceptó al menos una transacción | `201` |
| Cuerpo válido pero no entró ninguna (todas rechazadas) | `422` |
| Cuerpo no es objeto ni lista | `400` |
| Lote > 1000 | `413` |
| Cuerpo > 1 MB | `413` (nginx) |
| Demasiadas peticiones | `429` |

## Preguntas de seguridad frecuentes (y su respuesta)

**¿Se puede falsificar una transacción?**
No, si la clave no se filtra. La firma es HMAC con clave secreta; sin ella no se
puede producir una firma válida. (Antes, con hash público, sí se podía: ese
hueco se cerró.)

**¿Cuál es la "SECRET KEY" que pide el bot?**
`TRANSACTIONS_HMAC_SECRET`. Es una clave propia para firmar transacciones,
**distinta** de la clave interna de Django. Se le entrega al bot junto con la
URL y se rota por entorno.

**¿Protege contra inyección SQL?**
Sí: se usa el ORM de Django (consultas parametrizadas). Se probó con payloads de
inyección y no afectan la base.

**¿Y la detección de anomalías se puede engañar?**
Parcialmente: como la detección usa la **fecha que trae cada transacción**
(controlada por el emisor), alguien podría **separar las fechas** para no
concentrarse y evitar la marca. Es una limitación inherente al enunciado (los
datos de tiempo los pone el cliente). Mitigación posible a futuro: validar que
la fecha no venga muy desfasada del momento real de recepción.

## Cómo validar la seguridad tú mismo

### 1. Ver las cabeceras de seguridad
```bash
curl -i -X POST http://localhost:8000/api/v1/transactions/ \
  -H "Content-Type: application/json" -d '{}'
```
Fíjate en `X-Content-Type-Options`, `Referrer-Policy`, `Cache-Control`,
`Content-Security-Policy`. (El cuerpo vacío responde `422`: válido pero sin
transacciones aceptadas.)

### 2. Escaneo con OWASP ZAP (baseline)
```bash
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://TU_HOST/api/v1/transactions/
```
Las alertas típicas (cabeceras, cacheo, clickjacking) ya están cubiertas.

## Lo que NO cubre (honestidad)

- **Si la clave secreta se filtra**, se podría falsificar. Por eso se mantiene
  fuera del código (`.env`), fuera del navegador, y **se rota** por entorno.
- La detección confía en la **fecha declarada** por el cliente → evasión por
  separación de fechas (ver arriba).
- El throttling por origen se aplica detrás del proxy; para contar por IP real
  del cliente habría que leer la cabecera de reenvío. Para una sola fuente
  evaluadora es suficiente.
