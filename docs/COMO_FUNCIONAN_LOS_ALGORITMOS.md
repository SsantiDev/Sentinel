# Cómo funcionan los 4 algoritmos de Sentinel (explicación para cualquier persona)

Sentinel vigila sitios web y servicios: cada minuto los "visita" para ver si están
funcionando y cuánto tardan en responder. Con todo ese historial acumulado, cuatro
cálculos distintos sacan conclusiones útiles.

Este documento explica esos cuatro cálculos como si se los contáramos a alguien que nunca
programó ni trabajó en tecnología. Lo único técnico que vas a ver son dos cosas:

- **Las rutas**: en qué archivo y en qué línea está cada cálculo, para poder encontrarlo.
- **El código**: el fragmento clave, con cada línea traducida a lenguaje corriente.

Documentos relacionados: `docs/PLAN_ALGORITMOS.md` (por qué se eligió cada cálculo),
`docs/ALGORITMOS_APLICADOS.md` (detalle técnico y rendimiento),
`docs/PRUEBA_ALGORITMOS.md` (cómo probarlos desde la pantalla).

---

## Antes de empezar: tres palabras que se repiten

**Revisión.** Cada minuto, Sentinel entra al sitio que estás vigilando y anota tres cosas:
la fecha y hora exacta, si el sitio contestó bien o no contestó, y cuántas milésimas de
segundo tardó en contestar. Cada una de esas anotaciones es una "revisión". El historial de
un sitio es simplemente esa larga lista de revisiones, una atrás de otra.
(En el código a esto se le dice *check* o *chequeo*; acá le decimos "revisión".)

**Respondió bien / no respondió.** En cada revisión el sitio puede estar de dos maneras:
funcionando (contestó como corresponde) o caído (no contestó, o contestó con un error).
(En el código: `up` y `down`.)

**Tiempo de respuesta.** Cuántas milésimas de segundo tardó el sitio en contestar esa vez.
Un sitio rápido responde en 100 o 200 milésimas; uno lento, en 1000 o más.
(En el código: `response_time_ms`, la latencia.)

---

## El camino que recorre cada dato (los 4 cálculos pasan por acá)

Cuando abrís la pantalla de detalle de un sitio, siempre ocurre lo mismo:

1. Se abre la pantalla de detalle del sitio.
   `frontend/src/presentation/pages/ServiceDetailPage.jsx`
2. La pantalla le pide al servidor **tres cosas al mismo tiempo**: las estadísticas, si hay
   una caída en curso, y si el sitio se está poniendo lento.
   `frontend/src/application/hooks/useServiceAnalytics.js:14`
3. Los tres pedidos entran al servidor por el mismo lugar.
   `backend/interfaces/http/views/service_views.py:23`
4. El servidor busca en la base de datos las últimas revisiones del sitio y las entrega
   **ordenadas de la más vieja a la más nueva**.
   `backend/infrastructure/repositories/service_repository.py:60`
   Ese orden es obligatorio: los cuatro cálculos se apoyan en que la lista esté ordenada
   por fecha. Si llegara desordenada, darían resultados equivocados.
5. El servidor le pasa esa lista de revisiones al cálculo correspondiente.
   (Cada cálculo vive en su propio archivo dentro de `backend/application/use_cases/`.)
6. El cálculo devuelve un resultado chico: un número, una etiqueta o una fecha.
7. Ese resultado vuelve a la pantalla y aparece como un recuadro, una etiqueta o un aviso.

---

## Cálculo 1 — La libreta de calificaciones del sitio

### Para qué sirve

Resume la salud de un sitio en tres números fáciles de leer:

- **Disponibilidad (uptime).** De cada 100 revisiones, en cuántas el sitio estaba
  funcionando. Si de 100 visitas el sitio contestó bien 98 veces, la disponibilidad es
  98 %.

- **Tiempo de respuesta promedio.** Si sumás lo que tardó el sitio en todas las revisiones
  y lo dividís por la cantidad de revisiones, te da el tiempo "típico".

- **Tiempo de respuesta en los malos momentos (lo que técnicamente se llama "p95").**
  Imaginá que anotás cuánto tardó el sitio en las últimas 100 visitas y ordenás esos
  tiempos del más rápido al más lento, formando una fila. El p95 es el tiempo que quedó en
  el puesto número 95 de esa fila. Dicho en palabras: *"salvo por las 5 peores visitas de
  cada 100, el sitio responde en este tiempo o menos"*. Sirve para ver qué tan mal se pone
  el sitio cuando se pone mal, sin dejarse asustar por uno o dos desastres sueltos. Es
  importante porque el promedio puede verse bien y tapar que 1 de cada 10 veces el sitio
  tarda muchísimo; el p95 destapa eso.

Además, si preguntás "¿qué pasó a las 14:32?", este cálculo encuentra rápido la revisión
más cercana a esa hora usando un truco de búsqueda (ver más abajo, "búsqueda binaria").

### Dónde está en el código

| Qué | Archivo | Línea |
|-----|---------|-------|
| Cálculo de disponibilidad, promedio y "malos momentos" | `backend/application/use_cases/calculate_service_stats.py` | 17 (`calculate_service_stats`) |
| Cálculo del "malos momentos" (p95) | mismo archivo | 10 (`_percentile`) |
| Búsqueda rápida por hora | mismo archivo | 46 (`find_check_by_timestamp_binary`) |
| Búsqueda lenta, solo para comparar | mismo archivo | 67 (`find_check_by_timestamp_linear`) |
| Dirección que consulta la pantalla | `backend/interfaces/http/views/service_views.py` | 51 (`stats`) |

La pantalla consulta la dirección interna `GET /api/v1/services/{id}/stats/`.
Para ubicar una hora puntual: `.../stats/?at=2026-09-03T14:32:00`.

### Qué hace, paso a paso

1. Abrís el detalle del sitio. La pantalla pide las estadísticas.
2. El servidor trae las últimas revisiones (hasta 500).
3. Cuenta en cuántas el sitio estaba funcionando y saca el porcentaje de disponibilidad.
4. Junta todos los tiempos de respuesta, los ordena de menor a mayor, y con eso calcula
   el promedio y el número de "malos momentos".
5. Con la disponibilidad ya calculada, de una vez le pide al Cálculo 3 la medalla.
6. Si además preguntaste por una hora puntual, corre la búsqueda rápida y agrega qué
   revisión fue la más cercana.
7. Devuelve todo junto. En la pantalla aparece el recuadro de estadísticas.

### El código, explicado

```python
def calculate_service_stats(service_id, repo, tier_a1=80.0, tier_d=5.0, tier_n=4, window=500):
    checks = repo.get_checks_for_service(service_id, limit=window)      # trae hasta 500 revisiones
    total = len(checks)
    up_count = sum(1 for c in checks if c.status == ServiceStatus.UP)   # en cuántas el sitio funcionaba
    uptime_pct = (up_count / total * 100) if total else 0.0             # eso, en porcentaje

    latencies = sorted(c.response_time_ms for c in checks if c.response_time_ms is not None)
    avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else None  # tiempo promedio
    p95_latency = round(_percentile(latencies, 0.95), 2) if latencies else None     # tiempo en malos momentos

    tier = calculate_reliability_tier(uptime_pct, tier_a1, tier_d, tier_n)          # la medalla (Cálculo 3)
```

- `up_count`: recorre la lista una vez y suma 1 por cada revisión en la que el sitio estaba
  funcionando.
- `uptime_pct`: esa cuenta dividida por el total, expresada de 0 a 100. El
  `if total else 0.0` es para no hacer una división imposible cuando el sitio todavía no
  tiene ninguna revisión.
- `latencies = sorted(...)`: junta todos los tiempos de respuesta y los pone en fila de
  menor a mayor. Con la fila ordenada, el promedio es "sumar todo y dividir", y el número
  de malos momentos es "pararse en el puesto 95 de cada 100 y leer".

La búsqueda rápida para ubicar una hora (llamada "búsqueda binaria"):

```python
def find_check_by_timestamp_binary(checks, target):
    lo, hi = 0, len(checks) - 1        # miro entre la primera y la última revisión de la lista
    operations = 0
    while lo <= hi:
        operations += 1
        mid = (lo + hi) // 2            # me fijo en la del medio
        best = checks[mid]
        if checks[mid].checked_at == target:
            return checks[mid], operations         # justo esa hora: listo
        if checks[mid].checked_at < target:
            lo = mid + 1                # la hora que busco es más tarde: descarto toda la mitad de atrás
        else:
            hi = mid - 1               # es más temprano: descarto toda la mitad de adelante
    return best, operations            # no hay una exacta: devuelvo la más cercana
```

Es lo mismo que hacés al buscar una palabra en un diccionario de papel: abrís al medio,
ves que tu palabra va más adelante y ni mirás las páginas anteriores. Cada vistazo elimina
la mitad de lo que faltaba revisar. Con 1000 revisiones, encuentra la que buscás en unos
10 vistazos en lugar de 1000. El contador `operations` está solo para poder demostrar esa
diferencia en las pruebas.

### Qué aparece en pantalla

Un recuadro junto al estado del sitio: "Disponibilidad 98,5 %", "Respuesta 142 ms",
"En malos momentos 310 ms". Aparece al instante aunque haya cientos de revisiones.

---

## Cálculo 2 — ¿Desde qué hora está caído el sitio?

### Para qué sirve

Cuando un sitio está caído **en este momento**, responde: "está caído desde las 09:14".
Sin este cálculo, tendrías que abrir el historial y revisar visita por visita hacia atrás
hasta encontrar la primera que falló.

La idea para encontrarlo rápido: la lista de revisiones termina en una racha de fallas.
En vez de contar esa racha desde el final, se parte la lista al medio. Si la revisión del
medio **ya mostraba el sitio caído**, entonces la caída empezó en algún punto de la primera
mitad. Si en el medio el sitio todavía funcionaba, la caída empezó después. Se repite el
corte sobre la mitad que quedó, y sobre la mitad de esa mitad, hasta que queda una sola
revisión: esa es la primera de la caída. Es el juego de "adiviná el número del 1 al 100":
cada respuesta ("más alto" / "más bajo") elimina la mitad de las opciones.

### Dónde está en el código

| Qué | Archivo | Línea |
|-----|---------|-------|
| El corte por la mitad que se repite | `backend/application/use_cases/find_incident_start.py` | 8 (`_bisect_incident_start`) |
| La función que decide si hay una caída en curso | mismo archivo | 22 (`find_incident_start`) |
| Dirección que consulta la pantalla | `backend/interfaces/http/views/service_views.py` | 70 (`incidents`) |

La pantalla consulta `GET /api/v1/services/{id}/incidents/`.

### Qué hace, paso a paso

1. Abrís el detalle del sitio. La pantalla pregunta si hay una caída en curso.
2. El servidor trae las últimas revisiones (hasta 200).
3. La función mira **solo la revisión más reciente**:
   - Si en la última revisión el sitio funcionaba, no hay ninguna caída activa. Responde
     "sin incidente" y la pantalla no muestra nada.
   - Si en la última revisión el sitio estaba caído, arranca a cortar la lista por la mitad.
4. Corta y vuelve a cortar hasta que queda una sola revisión: esa es la primera de la caída.
5. Devuelve la hora de esa revisión y cuántos cortes necesitó.
6. En la pantalla aparece un aviso rojo: "Caído desde las 09:14".

### El código, explicado

```python
def find_incident_start(service_id, repo, window=200):
    checks = repo.get_checks_for_service(service_id, limit=window)
    if not checks or checks[-1].status != ServiceStatus.DOWN:
        return None            # en la última revisión el sitio NO está caído -> no hay caída activa
    ...
    start_index = _bisect_incident_start(checks, 0, len(checks) - 1, ops)
```

- `checks[-1]` es el último elemento de la lista, o sea la revisión más reciente.
- Ese `return None` es la razón por la que el aviso aparece únicamente cuando el sitio está
  caído ahora, y desaparece apenas se recupera.

```python
def _bisect_incident_start(checks, lo, hi, ops):
    ops[0] += 1
    if lo == hi:                       # quedó una sola revisión candidata: esa es el inicio
        return lo
    mid = (lo + hi) // 2
    if checks[mid].status == ServiceStatus.DOWN:
        return _bisect_incident_start(checks, lo, mid, ops)   # en el medio ya estaba caído -> el inicio está antes
    return _bisect_incident_start(checks, mid + 1, hi, ops)   # en el medio funcionaba -> la caída empezó después
```

- La función se **vuelve a llamar a sí misma** con un pedazo más chico de la lista, y ese
  pedazo con uno más chico todavía, hasta que queda una sola revisión. (A esto se le dice
  "recursión": el mismo procedimiento aplicado una y otra vez sobre lo que queda.)
- `if lo == hi` es el freno: cuando el pedazo se achica a una sola revisión, para y la
  devuelve. Sin ese freno, seguiría llamándose para siempre.
- `ops` es un contador de cuántos cortes hizo, para demostrar en las pruebas que con 16
  revisiones usa 5 cortes en vez de mirar las 16.

Límite conocido: este cálculo supone que la racha de fallas es continua hasta el final (que
no hubo una revisión buena suelta en medio de la caída). Es una suposición válida porque
busca la caída que está pasando ahora, no una del pasado. Está anotado como límite, no es
un error a corregir.

### Qué aparece en pantalla

Un aviso que se ve **solo** cuando el sitio está caído: "Servicio caído desde
2026-09-03 09:14". Si el sitio funciona, no hay aviso.

---

## Cálculo 3 — La medalla de confiabilidad

### Para qué sirve

Convierte el porcentaje de disponibilidad (un número que hay que interpretar) en una
etiqueta que se entiende de un vistazo: Bronce, Plata, Oro o Platino. Responde la pregunta
"¿este 96 % es bueno o malo?" sin que la persona tenga que pensarlo.

Los cortes entre una medalla y la siguiente se arman con una regla simple: se empieza en un
número y se suma siempre la misma cantidad. Empezando en 80 y sumando 5: 80, 85, 90, 95.
Son como los números de las casas de una cuadra o los escalones de una escalera: todos
separados por el mismo paso. (Esa regla de "sumar siempre lo mismo" se llama "progresión
aritmética".) El número de arranque, el paso y la cantidad de medallas se pueden cambiar
sin tocar el cálculo.

### Dónde está en el código

| Qué | Archivo | Línea |
|-----|---------|-------|
| Los nombres de las medallas | `backend/application/use_cases/calculate_reliability_tier.py` | 1 (`DEFAULT_TIER_NAMES`) |
| El cálculo de la medalla | mismo archivo | 4 (`calculate_reliability_tier`) |
| Quién lo usa | `backend/application/use_cases/calculate_service_stats.py` | 34 |

No tiene dirección propia: viaja junto con las estadísticas del Cálculo 1, en un campo
llamado `reliability_tier`.

### Qué hace, paso a paso

1. Abrís el detalle del sitio. Se piden las estadísticas (el mismo pedido del Cálculo 1).
2. El Cálculo 1 saca el porcentaje de disponibilidad del sitio.
3. Le pasa ese porcentaje a este cálculo, junto con el número de arranque (80), el paso (5)
   y la cantidad de medallas (4).
4. Este cálculo arma los cortes [80, 85, 90, 95] y busca la medalla más alta que el sitio
   alcanza.
5. Devuelve la etiqueta (por ejemplo "Oro"), que se suma a las estadísticas.
6. En la pantalla aparece como una etiqueta de color al lado del estado.

### El código, explicado

```python
DEFAULT_TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum"]

def calculate_reliability_tier(uptime_percentage, a1, d, n):
    thresholds = [a1 + i * d for i in range(n)]   # con arranque 80, paso 5, 4 medallas -> [80, 85, 90, 95]
    names = DEFAULT_TIER_NAMES[:n] if n <= len(DEFAULT_TIER_NAMES) else [f"Tier {i + 1}" for i in range(n)]

    tier = "Unranked"
    for threshold, name in zip(thresholds, names):
        if uptime_percentage >= threshold:
            tier = name          # cada vez que el sitio supera un corte, sube de medalla
    return tier
```

- `a1 + i * d` es la regla de "sumar siempre lo mismo": para los pasos 0, 1, 2 y 3 da
  80, 85, 90 y 95.
- El bucle recorre los cortes de menor a mayor. Cada vez que la disponibilidad del sitio
  supera un corte, la medalla se actualiza. Al terminar, quedó guardada la medalla más alta
  que el sitio alcanzó.
- Un sitio con 96 % supera 80, 85, 90 y 95, así que se lleva "Platino". Uno con 87 % supera
  80 y 85: se lleva "Plata". Uno con 70 % no supera ninguno: queda "Sin clasificar".

Por qué se suma siempre lo mismo y no se multiplica: si en vez de sumar 5 cada vez se
multiplicara, los cortes dejarían de estar parejos y pasar de una medalla a otra costaría
distinto en cada nivel.

### Qué aparece en pantalla

Una etiqueta junto al estado del sitio: "Oro". Solo cambia si cambia la disponibilidad
acumulada del sitio.

---

## Cálculo 4 — El aviso anticipado de que el sitio se está poniendo lento

### Para qué sirve

Los otros avisos de Sentinel llegan **tarde**: te avisan cuando el sitio ya se cayó o ya
respondió lento. Este llega **antes**: mira si el sitio viene respondiendo cada vez más
lento, de a poco, y calcula cuántas revisiones faltan para que cruce un límite de lentitud
que vos considerás inaceptable.

Es como mirar la aguja de la nafta bajando y calcular cuántos kilómetros te quedan antes de
quedarte varado. Actuás con tiempo, no cuando ya estás a pie.

Para saber si "viene subiendo", traza la línea recta que mejor acompaña a todos los tiempos
de respuesta anotados. Si esos puntos suben hacia la derecha, la línea sube; qué tan
empinada sube dice qué tan rápido está empeorando. Usa todos los puntos, no solo el primero
y el último, así una respuesta lenta suelta no arruina el pronóstico. (Trazar esa línea se
llama "regresión lineal".)

### Dónde está en el código

| Qué | Archivo | Línea |
|-----|---------|-------|
| El trazado de la línea recta | `backend/application/use_cases/predict_latency_trend.py` | 7 (`_linear_regression`) |
| El cálculo del pronóstico | mismo archivo | 20 (`predict_latency_trend`) |
| Dirección que consulta la pantalla | `backend/interfaces/http/views/service_views.py` | 85 (`trend`) |

La pantalla consulta `GET /api/v1/services/{id}/trend/?critical_ms=2000`
(`critical_ms` es el límite de lentitud en milésimas de segundo; si no lo mandás, usa 2000).

### Qué hace, paso a paso

1. Abrís el detalle del sitio. La pantalla pregunta por la tendencia de lentitud.
2. El servidor toma el límite de lentitud de la dirección (o 2000 por defecto) y trae las
   últimas revisiones (hasta 50).
3. Arma pares "número de revisión, tiempo que tardó". Si hay menos de 2 datos, responde
   "sin datos" y el recuadro no aparece.
4. Traza la línea recta y mide qué tan empinada sube: cuántas milésimas de segundo se suma
   el tiempo de respuesta por cada revisión nueva.
5. Si la línea sube (el sitio está empeorando), calcula en qué revisión futura la línea
   cruzaría el límite de lentitud, y resta la revisión actual: eso da "faltan N revisiones".
6. Devuelve qué tan empinada es la subida, si está empeorando, y cuántas revisiones faltan.
7. En la pantalla aparece un recuadro: "Estable" o "Empeorando: cruza el límite en unas
   8 revisiones".

### El código, explicado

```python
def _linear_regression(xs, ys):
    n = len(xs)
    mean_x = sum(xs) / n                 # promedio de las posiciones (revisión 0, 1, 2, ...)
    mean_y = sum(ys) / n                 # promedio de los tiempos de respuesta
    numerator   = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    denominator = sum((x - mean_x) ** 2 for x in xs)
    slope = numerator / denominator if denominator else 0.0   # qué tan empinada sube la línea
    intercept = mean_y - slope * mean_x                        # a qué altura arrancaría la línea
    return slope, intercept
```

- `xs` son las posiciones (revisión 0, 1, 2, ...) y `ys` son los tiempos de respuesta
  medidos en cada una.
- `slope` es el resultado que importa: si da 15, el sitio se suma unas 15 milésimas de
  segundo de demora por cada revisión. Si da 0 o un número negativo, no está empeorando.
- Las dos fórmulas del medio son la manera de toda la vida de trazar "la línea que mejor
  acompaña a los puntos", escrita a mano, sin usar herramientas externas.

```python
    is_degrading = slope > 0                # ¿la línea sube, o sea el sitio empeora?
    checks_to_breach = None
    if is_degrading:
        breach_x = (critical_threshold_ms - intercept) / slope   # en qué revisión la línea llega al límite
        remaining = breach_x - xs[-1]                            # menos la revisión actual
        checks_to_breach = round(remaining) if remaining > 0 else 0
```

- `breach_x` es "¿en qué número de revisión, si todo sigue igual, el tiempo de respuesta
  llegaría al límite de lentitud?".
- `remaining` le resta la última revisión real, para que el resultado sea "faltan N" y no
  "en la revisión número X".
- Si el sitio ya cruzó el límite, `remaining` da negativo y se informa `0` (ya es tarde).

### Qué aparece en pantalla

Un recuadro de tendencia. Con el sitio respondiendo parejo: "Estable", sin alarma. Con el
sitio poniéndose lento: qué tan rápido empeora y "Cruza 2000 ms en unas 8 revisiones".

---

## Resumen de ubicaciones

| Cálculo | Archivo | Función principal (línea) | Dirección que consulta la pantalla |
|---------|---------|---------------------------|------------------------------------|
| 1. Libreta de calificaciones + búsqueda por hora | `backend/application/use_cases/calculate_service_stats.py` | `calculate_service_stats` (17), `find_check_by_timestamp_binary` (46) | `GET /api/v1/services/{id}/stats/` |
| 2. Desde qué hora está caído | `backend/application/use_cases/find_incident_start.py` | `find_incident_start` (22), `_bisect_incident_start` (8) | `GET /api/v1/services/{id}/incidents/` |
| 3. Medalla de confiabilidad | `backend/application/use_cases/calculate_reliability_tier.py` | `calculate_reliability_tier` (4) | va dentro de `/stats/`, campo `reliability_tier` |
| 4. Aviso anticipado de lentitud | `backend/application/use_cases/predict_latency_trend.py` | `predict_latency_trend` (20), `_linear_regression` (7) | `GET /api/v1/services/{id}/trend/` |

Piezas de apoyo que usan los cuatro:

- Trae las revisiones ordenadas por fecha:
  `backend/infrastructure/repositories/service_repository.py:60` (`get_checks_for_service`)
- Forma de los resultados que se devuelven:
  `backend/domain/entities/analytics.py` (`ServiceStats`, `IncidentPeriod`, `LatencyTrend`)
- Lugar del servidor que atiende los tres pedidos:
  `backend/interfaces/http/views/service_views.py:23` (`ServiceViewSet`)
- La pantalla pide los tres al mismo tiempo:
  `frontend/src/application/hooks/useServiceAnalytics.js:14`
