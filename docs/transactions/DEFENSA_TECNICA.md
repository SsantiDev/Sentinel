# Defensa técnica — Módulo de transacciones

Guía para responder al profesor con el código en la mano. Cada respuesta dice
**qué pasa** y **dónde verlo** (`archivo:línea`). Las líneas corresponden al
estado actual del código (sesión 2026-10-08).

> Ruta base de los archivos: `backend/`. Abre el archivo y salta a la línea
> indicada para mostrarlo en vivo.

> **Nota importante — estado actual de la firma (para no contradecirte):**
> la firma HMAC **está implementada pero DESACTIVADA** para el bot/evaluador
> (`require_signature = False`, `config/settings/base.py:26` y la config en base).
> El bot **no comparte la clave secreta**, así que no puede firmar; por eso el
> hash que manda **no se valida**. En este modo las transacciones entran por
> **formato + anti-duplicado**, y el endpoint se protege con límite de peticiones,
> tope de lote, límites anti-500 y `DEBUG=False`. La firma se puede **activar**
> (interruptor en la configuración) y entonces sí se exige; el **simulador** sí
> firma (la clave vive en el servidor). Ver preguntas 2 y 2b.

---

## 1. ¿Cómo se construye el hash?

Es una **firma HMAC-SHA256**, no un hash plano. Se arma concatenando 5 campos en
orden fijo separados por `|` y se firma con una **clave secreta compartida**:

```
HMAC_SHA256( secreto, "idTxn|user|date|value|paymentMethod" )
```

- Construcción: `application/use_cases/transaction_hash.py:5-29`
- El mensaje concatenado: `transaction_hash.py:24`
- El algoritmo (HMAC + SHA256): `transaction_hash.py:25-29`

**Por qué HMAC y no SHA256 a secas:** sin la clave secreta nadie puede fabricar
una firma válida, así que no se pueden falsificar transacciones. Un SHA256 plano
cualquiera lo podría recalcular.

> Aclaración: esto describe cómo se firma **cuando la firma está activa** (lo usa
> el simulador). El **bot evaluador NO firma** (no tiene la clave), y hoy la firma
> está desactivada para él.

## 2. ¿Dónde se valida el hash?

**Solo se valida si la firma está activada** (`require_signature`). Hoy, para el
bot, está **desactivada**, así que su hash **no se valida** (ver pregunta 2b). El
Filtro 2 corre únicamente dentro de `if require_signature:` (`ingest_transactions.py:179`).

Cuando está activa:
- Función que compara: `transaction_hash.py:32-43`
- Se compara en **tiempo constante** con `hmac.compare_digest`: `transaction_hash.py:43`
  (evita ataques de temporización; no se usa `==`).
- Se invoca en la ingesta, como **Filtro 2**: `application/use_cases/ingest_transactions.py:179-192`
- La clave secreta sale de la configuración del servidor, nunca del cliente:
  `interfaces/http/views/transaction_views.py:116` (`settings.TRANSACTIONS_HMAC_SECRET`)
- Que la firma sea obligatoria o no es configurable en vivo:
  `transaction_views.py:114` (lee `require_signature` de la config en base);
  valor inicial sembrado desde entorno en `infrastructure/repositories/transaction_repository.py:37-40`.

## 2b. ¿El hash se está usando con el bot? (respuesta honesta)

**No.** Para el bot/evaluador la firma está **desactivada** (`require_signature=False`):
el bot no comparte la clave secreta, así que no puede producir una firma válida.
En ese modo el hash **se recibe y se guarda, pero no se valida**.

- El filtro de firma se omite cuando está apagado: `ingest_transactions.py:176-179`
- Entonces, ¿qué protege al endpoint abierto en ese modo?
  1. **Formato** (Filtro 1): la basura se descarta igual. `ingest_transactions.py:166-174`
  2. **Anti-duplicado** (Filtro 3): por `idTxn`. `:196-207`
  3. **Límites anti-500**: valores extremos se rechazan limpio. `:57-75`
  4. **Throttle** por IP y **tope de lote**. `transaction_views.py:85-86,102-107`
  5. **Modo seguro** al exponer (`DEBUG=False`). `config/settings/tunnel.py`
- La firma **se puede activar** si el emisor comparte la clave; ahí sí se exige.
  El **simulador** del front sí firma (clave en el servidor): `transaction_views.py:144-183`.

## 3. ¿Sobre qué valores se firma: los crudos enviados o los convertidos?

Sobre los **crudos tal como llegaron** (como texto), no sobre los ya convertidos.
Al validar se recalcula con `str(item['idTxn'])`, `str(item['date'])`,
`str(item['value'])`, etc.:

- `ingest_transactions.py:183-184`

Esto importa: la firma se valida contra exactamente lo que mandó el emisor, antes
de cualquier transformación.

## 4. ¿Qué fecha se guarda en la DB: la enviada o la del momento?

**La que manda el cliente.** Se guarda el campo `date` del payload. Además, en una
columna **aparte**, se guarda el momento real en que entró.

- Campo `date` (la enviada), sin `auto_now`: `infrastructure/models.py:161`
- Momento real de ingreso (automático): `models.py:166` (`created_at = auto_now_add=True`)
- Parseo de la fecha enviada: `ingest_transactions.py:33-39` y `:78-85`
- Se pasa a la entidad y se guarda tal cual: `ingest_transactions.py:124,130` →
  `transaction_repository.py:63-72` (`date=t.date`)

Para la **anomalía** es igual: el momento de detección es automático
(`detected_at`, `models.py:201`), mientras que `window_start`/`window_end` salen de
las fechas **enviadas** de las transacciones (`detect_transaction_anomalies.py:87-88`).

**Resumen:** `date` = la del cliente; `created_at`/`detected_at` = el momento real.
Así puedes auditar ambas cosas.

## 5. ¿Qué pasa si la fecha viene sin zona horaria?

Se asume la zona por defecto del proyecto (UTC) para no guardar fechas "naive":

- `ingest_transactions.py:37-38`
- El proyecto trabaja en UTC: `config/settings/base.py:162` (`TIME_ZONE='UTC'`, `USE_TZ=True` en `:164`)

## 6. ¿Cómo se valida la estructura de cada transacción?

En **3 filtros en orden** (formato → firma → duplicado). Si una falla, se descarta
con su motivo y se sigue con las demás (una mala no tumba el lote):

- Campos obligatorios presentes: `ingest_transactions.py:95-97`
- Rechazo de booleanos disfrazados de número (`true`/`false`): `:101-104`
- `idTxn` entero: `:106-109` · `value` numérico: `:115-118` · `date` ISO 8601: `:78-85`
- `user`/`paymentMethod` no vacíos: `:111-113`, `:120-122`
- Orquestación de los 3 filtros: `:165-210`

## 7. ¿Por qué un valor gigante o basura no tumba el servidor (500)?

Porque antes de guardar se **acotan los tamaños** a lo que cabe en cada columna de
la base. El guardado en bloque (`bulk_create`) se salta la validación de Django, así
que esta comprobación evita que un valor enorme reviente en la base:

- Límites de columnas y chequeo: `ingest_transactions.py:57-75` (`_ensure_db_bounds`)
- Se llama al final del parseo: `:127`
- Cubre: `idTxn` fuera de rango de entero largo, textos demasiado largos, montos no
  finitos o con más de 2 decimales / más de 18 dígitos.

Resultado: esos casos se rechazan como `INVALID_PAYLOAD` (422), no como error 500.

## 8. ¿Cómo se evita procesar dos veces la misma transacción?

Por `idTxn`, en dos niveles (**Filtro 3**):

- Repetida dentro del mismo lote: `ingest_transactions.py:196-201`
- Ya existente en la base: `:202-207` → implementación `transaction_repository.py:59-61`

## 9. ¿Qué es una anomalía y cómo se detecta?

Una anomalía es una **ventana de tiempo donde un usuario supera el límite** de
transacciones de esa franja horaria. Se detecta por usuario, con **ventanas no
solapadas**:

- Punto de entrada (agrupa por usuario y ordena por fecha): `detect_transaction_anomalies.py:99-126`
- Algoritmo de ventanas no solapadas: `:31-96` (`_detect_for_user`)
- Una ráfaga larga se reparte en varias ventanas (no colapsa en una): ver docstring `:41-52`
- Se corre contra el **historial** del usuario, no solo el lote, para detectar
  ráfagas partidas entre peticiones: `ingest_transactions.py:220-231`
- Anti-doble-reporte de la misma ráfaga: `ingest_transactions.py:235-238` →
  `transaction_repository.py:87-98` (`exists_overlapping_anomaly`)
- Marca las transacciones involucradas como anómalas: `ingest_transactions.py:243,245-246`
  → `transaction_repository.py:74-76`

## 10. ¿De dónde sale el nivel (bajo / medio / alto)?

De **cuánto supera** la ventana al límite (`count / threshold`):

- `detect_transaction_anomalies.py:11-28` (`_severity_level`): `>=2` alto, `>=1.5` medio, resto bajo.

## 11. ¿Cómo cambia el límite según la hora?

Hay 3 franjas horarias con límites distintos; la **ventana en segundos es fija**,
lo que cambia es el **límite**:

- Bordes de franja (al segundo): `application/use_cases/time_band.py:9-17`
- Clasificación de la franja: `time_band.py:20-33`
- Límite por franja: `time_band.py:36-42`
- Valores por defecto (mañana 10 / tarde 6 / noche 3): `domain/entities/transaction.py:48-51`

## 12. El endpoint es abierto (sin login). ¿Cómo se protege entonces?

- Sin autenticación (para que un bot lo evalúe): `transaction_views.py:82` (`AllowAny`)
- **Firma HMAC** configurable (anti-falsificación) — **hoy DESACTIVADA para el bot**,
  así que en este modo NO protege; ver preguntas 2 y 2b
- **Límite de peticiones por IP** (anti-inundación): `transaction_views.py:85-86`
  (scope `transactions_ingest`); tasa en `settings/base.py:126` (3000/min)
- **Tope de tamaño de lote** (anti-agotamiento de memoria): `transaction_views.py:102-107`;
  valor en `settings/base.py:130` (1000)
- **Modo seguro al exponer** (no filtra trazas): `config/settings/tunnel.py` (`DEBUG=False`)
- Manejador de errores que registra 5xx sin filtrarlos: `config/exception_handler.py:8-30`

## 13. ¿Qué código HTTP devuelve y cuándo?

- `201` si se aceptó al menos una transacción; `422` si el cuerpo era válido pero no
  entró ninguna (todas rechazadas): `transaction_views.py:47-69` (`_ingest_response`)
- `400` si el cuerpo no es un objeto ni una lista: `transaction_views.py:95-99`
- `413` si el lote supera el tope: `transaction_views.py:102-107`

## 14. ¿Dónde quedan los logs y qué registran?

- Archivo rotativo `backend/logs/sentinel.log` (NUNCA en la base).
- Por cada petición: IP real de origen, cuántas se aceptaron/rechazaron y las anomalías:
  `transaction_views.py:121-128`
- Por cada rechazo: `idTxn`, motivo y detalle exacto: `transaction_views.py:130-141`
- Configuración del logger: `config/settings/logging_config.py`
- Se puede ver desde la pantalla "Registros" (`/logs`, solo admin).

## 15. ¿Cómo sé que el dashboard muestra datos correctos?

El tablero lee el endpoint de estadísticas, que **deriva** porcentajes y promedios de
los **conteos crudos** de la base (no inventa nada):

- Derivados (tasa, promedio): `application/use_cases/calculate_transaction_stats.py:16-24`
- Conteos crudos: `infrastructure/repositories/transaction_metrics.py:26-81`
- Distribución por hora: `transaction_metrics.py:114-120` · Evolución diaria: `:122-142`

Verificación hecha el 2026-10-08: los valores del endpoint coincidieron 1:1 con un
conteo directo de las tablas (txns, anomalías, nivel, usuarios afectados, valor
sospechoso).

---

## Más preguntas para practicar (16–30)

### 16. ¿Qué arquitectura usa el backend y cómo fluyen las dependencias?
Clean Architecture por capas; las dependencias apuntan **hacia adentro**:
`domain` ← `application` ← (`infrastructure` / `interfaces`).
- `domain` (entidades, sin dependencias): `domain/entities/transaction.py`
- `application` (casos de uso, dependen de interfaces del dominio): `ingest_transactions.py:10,137` usa `ITransactionRepository`
- `infrastructure` (implementa la interfaz): `transaction_repository.py:15`
- `interfaces` (HTTP/DRF): `transaction_views.py`

### 17. ¿Por qué la detección está en un caso de uso y no en la vista?
Para que la lógica de negocio sea pura y **testeable** sin HTTP ni base de datos.
La vista solo orquesta; la detección vive en `application/use_cases/detect_transaction_anomalies.py` y se prueba sola en `tests/unit/test_detect_transaction_anomalies.py`.

### 18. ¿Qué pasa si llegan dos transacciones con el mismo `idTxn` en el mismo lote?
La segunda se rechaza como `DUPLICATE` (se lleva un conjunto de `idTxn` ya vistos en el lote). → `ingest_transactions.py:159-161,196-201`

### 19. ¿Y si una ráfaga llega partida en dos peticiones distintas?
También se detecta: la detección corre contra el **historial** del usuario, no solo el lote, y evita reportar dos veces la misma ventana. → `ingest_transactions.py:220-238`

### 20. ¿Por qué se guarda en bloque (`bulk_create`) y qué riesgo trae?
Por rendimiento (un solo INSERT para muchas filas) → `transaction_repository.py:63-72`. El riesgo: `bulk_create` **se salta** la validación de Django, por eso se acotan los tamaños antes (`_ensure_db_bounds`, `ingest_transactions.py:57-75`).

### 21. ¿Por qué el simulador exige login y la ingesta no?
La ingesta es pública a propósito (para un bot evaluador) y se protege con firma/throttle/tope. El simulador firma **en el servidor** con la clave secreta, así que la confianza viene de la sesión del usuario, no de una firma del navegador. → `transaction_views.py:144-183` (simulador) vs `:72-141` (público)

### 22. ¿Qué devuelve si TODO el lote es basura?
`422` (cuerpo válido pero no entró ninguna). Si el cuerpo ni siquiera es objeto/lista → `400`. → `transaction_views.py:47-69,95-99`

### 23. ¿Cómo se evita que un error interno (500) filtre información?
Con `DEBUG=False` al exponer (`config/settings/tunnel.py`) y un manejador que registra el 5xx sin devolver la traza al cliente (`config/exception_handler.py:8-30`).

### 24. ¿Qué pasa con un valor negativo o cero?
Se acepta (no se rechaza por signo). No dispara anomalía por sí mismo: la anomalía es por **concentración en el tiempo**, no por el monto. El monto solo alimenta el "valor sospechoso" y el nivel no depende de él.

### 25. ¿La detección mezcla transacciones de distintos usuarios?
No. Primero agrupa por usuario; cada uno tiene su propia ventana independiente. → `detect_transaction_anomalies.py:118-125`

### 26. ¿Qué algoritmo usa la detección y cuál es su costo?
Por usuario: se ordena por fecha (O(n log n)) y luego un **barrido de ventanas no solapadas** en O(n). → ordenar `detect_transaction_anomalies.py:124`; barrido `:61-94`.

### 27. ¿De dónde salen la ventana y los límites, y se pueden cambiar?
Valores por defecto en la entidad de configuración (`domain/entities/transaction.py:48-51`); viven en la base y se editan en vivo desde `GET/PUT /api/v1/detection-config/` (`transaction_views.py:236-268`). La ingesta los lee con `repo.get_config()` (`ingest_transactions.py:217`).

### 28. ¿Cómo se prueba el sistema?
Tests unitarios (hash, detección, stats) e integración del endpoint, corriendo en Docker. → `backend/tests/unit/…`, `backend/tests/integration/test_transaction_views.py`.

### 29. ¿Cómo se expone de forma segura a internet?
Túnel (Cloudflare) + modo seguro (`DEBUG=False`) + firma HMAC configurable + límite de peticiones por IP + tope de lote. Cada petición queda en el log con la IP real.

### 30. ¿Qué pasa si el bot manda 10.000 transacciones en una sola petición?
Se responde `413` (tope 1.000 por cuerpo). → `transaction_views.py:102-107`; valor en `config/settings/base.py:130`.

---

## Mapa de verificación rápida

| Concepto | Archivo : línea |
|---|---|
| Construcción del hash (HMAC-SHA256) | `application/use_cases/transaction_hash.py:5-29` |
| Mensaje firmado (orden de campos) | `transaction_hash.py:24` |
| Validación del hash (tiempo constante) | `transaction_hash.py:32-43` |
| Llamada a validación de firma (Filtro 2) | `application/use_cases/ingest_transactions.py:179-192` |
| Clave secreta (lado servidor) | `interfaces/http/views/transaction_views.py:116` |
| Fecha guardada = la enviada | `infrastructure/models.py:161` |
| Momento real de ingreso (automático) | `infrastructure/models.py:166` |
| Momento de detección de anomalía | `infrastructure/models.py:201` |
| Parseo/zona horaria de la fecha | `ingest_transactions.py:33-39` |
| Validación de estructura (3 filtros) | `ingest_transactions.py:88-132`, `:165-210` |
| Límites anti-500 (tamaños de columna) | `ingest_transactions.py:57-75` |
| Anti-duplicado (idTxn) | `ingest_transactions.py:196-207`, `transaction_repository.py:59-61` |
| Detección por ventanas no solapadas | `application/use_cases/detect_transaction_anomalies.py:31-96` |
| Nivel de severidad | `detect_transaction_anomalies.py:11-28` |
| Franjas horarias y límites | `application/use_cases/time_band.py:9-42` |
| Códigos 201 / 422 / 400 / 413 | `transaction_views.py:47-69`, `:95-99`, `:102-107` |
| Throttle y tope de lote | `transaction_views.py:85-86`, `:102-107`; `settings/base.py:126,130` |
| Logs de ingesta y rechazos | `transaction_views.py:121-141` |
| Estadísticas del dashboard | `calculate_transaction_stats.py`, `transaction_metrics.py:26-142` |
| Modo seguro para exponer (DEBUG off) | `config/settings/tunnel.py` |
| Reset horario (se auto-apaga) | `infrastructure/tasks/transaction_tasks.py:23-40`; cutoff `settings/base.py:32` |

---

## Endpoints (rutas)

Base: `/api/v1/` — definidas en `interfaces/http/urls.py`.

| Método | Ruta | Para qué | Definición |
|---|---|---|---|
| POST | `/transactions/` | Ingesta pública (el bot) | `urls.py:33` → `transaction_views.py:72-141` |
| POST | `/transactions/simulate/` | Simulador (autenticado, firma en servidor) | `urls.py:34` → `transaction_views.py:144-183` |
| GET | `/transaction-anomalies/` | Lista de anomalías | `urls.py:24` (router) |
| GET | `/transaction-anomalies/stats/` | Métricas del dashboard | `transaction_views.py:195-199` |
| GET | `/transaction-anomalies/trends/` | Serie horaria y diaria | `transaction_views.py:201-206` |
| GET | `/transaction-anomalies/{id}/timeline/` | Línea de tiempo de una anomalía | `transaction_views.py:208-233` |
| PATCH | `/transaction-anomalies/{id}/` | Cambiar estado (open/reviewed/discarded) | `urls.py:24` (router) |
| GET/PUT | `/detection-config/` | Configuración de detección (solo admin) | `urls.py:35` → `transaction_views.py:236-268` |

---

## Flujo completo de una petición POST `/transactions/`

1. Entra al view y se normaliza a lista — `transaction_views.py:88-92`
2. Cuerpo inválido → 400 / lote muy grande → 413 — `:95-107`
3. Se llama al caso de uso con la clave y si la firma es obligatoria — `:113-118`
4. **Filtro 1 — formato:** parseo + límites de columna — `ingest_transactions.py:166-174` (`_parse_one` `:88-132`)
5. **Filtro 2 — firma:** HMAC en tiempo constante (si se exige) — `:179-192`
6. **Filtro 3 — duplicado:** por `idTxn`, en lote y en base — `:196-207`
7. Guardado en bloque de las válidas — `:215`
8. Detección por ventanas no solapadas contra el historial — `:217-243`
9. Marca de transacciones anómalas — `:245-246`
10. Respuesta 201/422 + log de la petición — `transaction_views.py:121-128`, `_ingest_response` `:47-69`
