# Guía simple — los 4 algoritmos explicados con un caso real

Un solo ejemplo para los 4, de punta a punta: estás monitoreando `api.tutienda.com`, la API de pagos de un e-commerce. Sentinel le hace un chequeo cada 60 segundos (arriba/abajo, cuánto tardó en responder). Con el tiempo se acumulan miles (o millones) de esos chequeos guardados. Los 4 algoritmos existen para responder 4 preguntas distintas sobre esos datos, rápido, sin tener que revisar chequeo por chequeo a mano.

**Cómo leer los "recorridos" de este documento:** cada uno es una lista de pasos. Cada paso dice el archivo real (podés abrirlo) y el número de línea real de ese archivo (el mismo número que ves en tu editor al costado del código). Van en orden: el paso 1 es lo primero que se ejecuta, y su código literalmente llama al código del paso 2, que llama al del paso 3, y así — es el camino real que sigue la computadora, no un resumen.

Cada sección de algoritmo responde, en este orden:
- **Cuándo se dispara** (qué hace el usuario para que esto corra)
- **Qué pregunta responde**
- **Cómo funciona** (la idea, sin código)
- **Recorrido real** (archivo y línea exactos, en orden de ejecución)
- **Si hubiera 500 millones de chequeos guardados** ¿se cae el sistema?
- **Si alguien cambia una variable importante sin querer** ¿qué se rompe?

---

## 1. Búsqueda binaria — "¿cómo estaba el servicio en tal momento exacto?"

**Cuándo se dispara:** el usuario entra a la pantalla de detalle de `api.tutienda.com` en el dashboard. Apenas esa pantalla carga, pide automáticamente las estadísticas al backend (uptime %, latencia promedio, etc.) — eso ya usa este algoritmo. Si además busca "¿qué pasaba a las 14:32 del martes pasado?", ahí se activa la parte de búsqueda por fecha específicamente.

**Qué pregunta responde:** dado un instante exacto en el tiempo, encontrar el chequeo más cercano a ese instante, sin mirar todos los chequeos guardados uno por uno.

**Cómo funciona:** los chequeos están ordenados por fecha, del más viejo al más nuevo. En vez de empezar del principio y revisar uno por uno (lento con muchos datos), el algoritmo va directo al chequeo del medio, pregunta "¿lo que busco es antes o después de este?", descarta la mitad que no sirve, y repite sobre la mitad que queda. Es la misma lógica de buscar una palabra en un diccionario en papel: no empezás por la "A", abrís por la mitad y seguís descartando mitades.

**Recorrido real, archivo por archivo:**

1. **`frontend/src/application/hooks/useServiceAnalytics.js`, línea 14-18.** Apenas el componente de la pantalla se monta, este hook dispara 3 pedidos HTTP a la vez. La línea 15 puntual es la que interesa acá: `apiClient.get(\`/services/${id}/stats/\`)`. Esto sale del navegador como un pedido HTTP real hacia el backend.

2. **`backend/interfaces/http/views/service_views.py`, línea 52.** Django recibe ese pedido HTTP y lo rutea a la función `def stats(self, request, pk=None):` — esta es la primera línea de código *backend* que se ejecuta, disparada directamente por el paso 1.

3. **Mismo archivo, línea 53.** `service = self.get_object()` — busca en la base de datos cuál es el servicio con ese id (`api.tutienda.com`).

4. **Mismo archivo, línea 55.** `result = calculate_service_stats(service.id, repo)` — esta línea salta a otro archivo: adentro de `calculate_service_stats` es donde arranca el algoritmo de verdad.

5. **`backend/application/use_cases/calculate_service_stats.py`, línea 25.** Ya adentro de esa función, la primera línea de su cuerpo es `checks = repo.get_checks_for_service(service_id, limit=window)` — le pide al repositorio los últimos 500 chequeos (línea 23 de ese mismo archivo es donde dice `window: int = 500`, el valor por defecto).

6. **Volviendo a `service_views.py`, líneas 58-61** (solo si la URL trae `?at=`). La línea 61 es la que llama puntualmente al algoritmo de búsqueda binaria: `nearest, operations = find_check_by_timestamp_binary(checks, datetime.fromisoformat(at_param))`.

7. **`calculate_service_stats.py`, líneas 46-64.** Acá vive la función `find_check_by_timestamp_binary` en sí — el algoritmo de búsqueda binaria. Punto clave: línea 51 (`lo, hi = 0, len(checks) - 1`, arranca cubriendo toda la lista), línea 56 (`mid = (lo + hi) // 2`, calcula el punto medio — esto se repite en cada vuelta del `while` de la línea 54), y líneas 61/63 (`lo = mid + 1` o `hi = mid - 1`, descarta la mitad que no sirve).

8. **De vuelta en `service_views.py`, línea 68.** `return Response(data)` — arma la respuesta HTTP con todo lo calculado y la manda de vuelta al navegador.

9. **De vuelta en `useServiceAnalytics.js`, línea 19.** `setStats(statsRes.data)` — el frontend recibe la respuesta y la guarda, lo que hace que React vuelva a dibujar la pantalla con los números nuevos.

**Si hubiera 500 millones de chequeos guardados:** el algoritmo del paso 7 no se entera — nunca mira más de 500 chequeos a la vez (eso lo fija la línea 23 de `calculate_service_stats.py`), así que buscar entre 500 o entre 500 millones le cuesta lo mismo. Lo que sí puede volverse lento es el paso 5, la consulta a la base de datos — se explica en detalle en la sección final de este documento.

**Si se cambia una variable importante:** la variable clave es `window` (línea 23 de `calculate_service_stats.py`, hoy en 500). Si alguien la baja a 20, las estadísticas de uptime se calculan solo con los últimos 20 chequeos — el dashboard puede mostrar "99% uptime" aunque el servicio haya estado caído toda la semana pasada, porque esos datos quedaron afuera de la ventana. Si la sube a un número enorme, cada carga de esa pantalla se vuelve más lenta y pesada.

---

## 2. Recursión (bisección) — "¿desde cuándo está caído?"

**Cuándo se dispara:** misma pantalla de detalle, al cargar. Si el servicio está caído ahora mismo, el dashboard muestra un aviso ("incidente activo desde..."). Si el servicio está funcionando bien, este algoritmo directamente no llega a correr.

**Qué pregunta responde:** si el servicio está caído ahora, ¿en qué chequeo empezó a caerse?

**Cómo funciona:** misma idea de "partir a la mitad" que la búsqueda binaria, pero en vez de repetirla con un bucle, la función se llama a sí misma con un pedazo más chico del problema cada vez, hasta que le queda un solo chequeo — ese es el inicio del incidente. Es la lógica de "adivina el número": preguntás "¿es más de 50?", y según la respuesta partís a la mitad el rango que queda, hasta acertar.

**Recorrido real, archivo por archivo:**

1. **`frontend/src/application/hooks/useServiceAnalytics.js`, línea 16.** `apiClient.get(\`/services/${id}/incidents/\`)` — mismo `Promise.all` del algoritmo 1, es el segundo de los 3 pedidos que se disparan juntos.

2. **`backend/interfaces/http/views/service_views.py`, línea 71.** Django rutea el pedido a `def incidents(self, request, pk=None):`.

3. **Mismo archivo, línea 74.** `incident = find_incident_start(service.id, repo)` — salta al caso de uso.

4. **`backend/application/use_cases/find_incident_start.py`, línea 25.** `checks = repo.get_checks_for_service(service_id, limit=window)` — trae hasta 200 chequeos (la línea 23 del mismo archivo fija `window: int = 200`).

5. **Mismo archivo, línea 26.** `if not checks or checks[-1].status != ServiceStatus.DOWN:` — chequea si el último chequeo está caído. Si no lo está, línea 27 corta con `return None` y la recursión ni arranca.

6. **Mismo archivo, línea 30.** `start_index = _bisect_incident_start(checks, 0, len(checks) - 1, ops)` — acá arranca la recursión, llamando a la función de la línea 8 del mismo archivo.

7. **Mismo archivo, líneas 8-19 (la función `_bisect_incident_start`).** Línea 14 es el caso base (`if lo == hi: return lo`, ahí termina la recursión). Línea 16 calcula el punto medio (`mid = (lo + hi) // 2`). Líneas 18 y 19 son las dos formas en que la función se llama a sí misma, con un rango cada vez más chico, hasta llegar al caso base de la línea 14.

8. **De vuelta en `service_views.py`, líneas 78-83.** Arma la respuesta HTTP con `incident.start_check.checked_at`, `incident.is_ongoing` e `incident.operations_count`.

9. **De vuelta en `useServiceAnalytics.js`, línea 20.** `setIncident(incidentRes.data)` — guarda el resultado, la pantalla se actualiza con el aviso de incidente si corresponde.

**Límite conocido:** si `api.tutienda.com` lleva caído más tiempo del que cubren esos 200 chequeos, el algoritmo (paso 7) va a reportar como "inicio" el borde de esa ventana, no el momento real — porque nunca llegó a ver más atrás.

**Si hubiera 500 millones de chequeos guardados:** sin impacto — el `window: int = 200` de la línea 23 de `find_incident_start.py` sigue limitando a 200 sin importar cuántos existan en total.

**Si se cambia una variable importante:** esa misma línea 23, `window`. Bajarla mucho (a 10) hace que el límite conocido de arriba se dispare con cualquier incidente de más de 10 chequeos.

---

## 3. Progresión aritmética — "¿qué nivel de confiabilidad tiene?"

**Cuándo se dispara:** no tiene pedido HTTP propio — viaja pegado adentro del algoritmo 1. Se ve en el dashboard como una medalla: Bronze, Silver, Gold o Platinum.

**Qué pregunta responde:** dado el porcentaje de uptime (ej. 92%), ¿en qué categoría cae?

**Cómo funciona:** se definen escalones parejos, separados siempre por la misma distancia — como las notas de un examen: 80 para aprobar, 85 para "notable", 90 para "sobresaliente", 95 para "excelente", cada uno 5 puntos más que el anterior. Se genera esa escalera a partir de 3 números (dónde arranca, cuánto mide cada escalón, cuántos escalones hay), y se ubica el porcentaje real en el escalón más alto que alcanza.

**Recorrido real, archivo por archivo:**

1. **`backend/application/use_cases/calculate_service_stats.py`, línea 28.** `uptime_pct = (up_count / total * 100) if total else 0.0` — este número, calculado acá, es el que va a viajar al algoritmo 3. No hace falta que el usuario pida nada aparte, esto ya corrió como parte del paso 5 del recorrido del algoritmo 1.

2. **Mismo archivo, línea 34.** `tier = calculate_reliability_tier(uptime_pct, tier_a1, tier_d, tier_n)` — acá se llama al algoritmo 3, pasándole el `uptime_pct` recién calculado y 3 valores por defecto (`tier_a1=80.0`, `tier_d=5.0`, `tier_n=4`, definidos en las líneas 20-22 del mismo archivo).

3. **`backend/application/use_cases/calculate_reliability_tier.py`, línea 7.** `thresholds = [a1 + i * d for i in range(n)]` — con los valores del paso 2, esto genera `[80, 85, 90, 95]`.

4. **Mismo archivo, líneas 10-13.** El bucle `for threshold, name in zip(thresholds, names):` recorre esos 4 escalones de menor a mayor, y en la línea 12-13 (`if uptime_percentage >= threshold: tier = name`) se va quedando con el nombre del escalón más alto que el uptime real alcanza a cumplir.

5. **Mismo archivo, línea 14.** `return tier` — devuelve el nombre (ej. "Gold") de vuelta a la línea 34 de `calculate_service_stats.py`, donde quedó guardado en la variable `tier`.

6. **`calculate_service_stats.py`, línea 42.** `reliability_tier=tier` — este valor se empaqueta junto con el resto de las estadísticas en el objeto que se devuelve, y sigue el mismo camino de salida que el algoritmo 1 (pasos 8 y 9 de esa sección).

**Si hubiera 500 millones de chequeos guardados:** cero impacto — el paso 3 nunca mira un chequeo individual, solo recibe el número de uptime ya calculado.

**Si se cambia una variable importante:** las 3 variables del paso 2 (`tier_a1`, `tier_d`, `tier_n`, líneas 20-22 de `calculate_service_stats.py`). Si `tier_d` se pone en 0, todos los escalones quedan en el mismo punto (línea 7 de `calculate_reliability_tier.py` daría `[80, 80, 80, 80]`) y el sistema no puede diferenciar Bronze de Platinum.

---

## 4. Regresión lineal — "¿se está por poner lento, y cuándo se vuelve crítico?"

**Cuándo se dispara:** misma pantalla de detalle, al cargar — tarjeta de "tendencia" de latencia. El usuario puede ajustar el límite que considera "crítico" desde el frontend.

**Qué pregunta responde:** mirando los últimos chequeos, ¿la latencia va empeorando? Si va empeorando, ¿en cuántos chequeos más va a cruzar el límite crítico?

**Cómo funciona:** toma los últimos 50 chequeos y traza la línea recta que mejor representa la tendencia general de esos puntos. Si la línea sube, el servicio se está poniendo más lento. Con esa misma línea se calcula en qué punto futuro va a cruzar el umbral que definiste.

**Recorrido real, archivo por archivo:**

1. **`frontend/src/application/hooks/useServiceAnalytics.js`, línea 17.** `apiClient.get(\`/services/${id}/trend/\`)` — el tercer pedido del mismo `Promise.all`.

2. **`backend/interfaces/http/views/service_views.py`, línea 86.** Django rutea a `def trend(self, request, pk=None):`.

3. **Mismo archivo, línea 89.** `critical_ms = float(request.query_params.get('critical_ms', 2000))` — lee el umbral que mandó el usuario en la URL, o usa 2000 (2 segundos) si no mandó nada.

4. **Mismo archivo, línea 90.** `trend = predict_latency_trend(service.id, repo, critical_threshold_ms=critical_ms)` — salta al caso de uso, llevándose el `critical_ms` del paso 3.

5. **`backend/application/use_cases/predict_latency_trend.py`, línea 26.** `checks = repo.get_checks_for_service(service_id, limit=window)` — trae hasta 50 chequeos (línea 24 del mismo archivo, `window: int = 50`).

6. **Mismo archivo, línea 33.** `slope, intercept = _linear_regression(xs, ys)` — llama a la función de la línea 7 del mismo archivo para calcular la recta.

7. **Mismo archivo, líneas 7-17 (función `_linear_regression`).** Línea 13 calcula la covarianza (`numerator`), línea 14 la varianza (`denominator`), línea 15 divide una por otra para obtener la pendiente (`slope`), línea 16 calcula dónde arranca la recta (`intercept`).

8. **De vuelta en `predict_latency_trend.py`, línea 35.** `is_degrading = slope > 0` — si la pendiente calculada en el paso 7 es positiva, la latencia sube.

9. **Mismo archivo, líneas 37-40.** Si está degradando, la línea 38 (`breach_x = (critical_threshold_ms - intercept) / slope`) proyecta en qué chequeo futuro se cruza el umbral del paso 3, y la línea 39 calcula cuántos chequeos faltan desde ahora.

10. **De vuelta en `service_views.py`, líneas 94-99.** Arma la respuesta HTTP con `slope_ms_per_check`, `is_degrading`, `predicted_checks_to_breach`.

11. **De vuelta en `useServiceAnalytics.js`, línea 21.** `setTrend(trendRes.data)` — la pantalla muestra la tarjeta de tendencia actualizada.

**Si hubiera 500 millones de chequeos guardados:** sin impacto — el paso 5 siempre corta en 50 (línea 24 de `predict_latency_trend.py`), sin importar cuántos millones más existan de historia vieja.

**Si se cambia una variable importante:** dos variables. Primero, `window` (línea 24, hoy 50): bajarla mucho hace que un pico raro de latencia distorsione toda la predicción. Segundo, `critical_ms` (línea 89 de `service_views.py`, el usuario lo controla desde el frontend): si se pone demasiado alto, el sistema nunca avisa aunque el servicio esté objetivamente lento.

---

## La pregunta de fondo: "¿aguanta 500 millones de registros?"

El cálculo en sí, siempre aguanta — ninguno de los 4 algoritmos mira más de un puñado de chequeos recientes (entre 50 y 500, fijado en la línea `window` de cada caso de uso, ya señaladas arriba). El riesgo real está un paso antes, en la consulta a la base de datos que le da de comer a esos algoritmos. Recorrido de esa consulta puntual:

1. **`backend/application/use_cases/calculate_service_stats.py`, línea 25** (y su equivalente, línea 25 de `find_incident_start.py`, línea 26 de `predict_latency_trend.py`): `repo.get_checks_for_service(service_id, limit=window)` — los 3 algoritmos llaman a la misma función de repositorio, cada uno con su propio `window`.

2. **`backend/infrastructure/repositories/service_repository.py`, línea 60.** `def get_checks_for_service(self, service_id, limit=None):` — acá es donde esa llamada realmente aterriza.

3. **Mismo archivo, línea 63.** `recent = CheckResultModel.objects.filter(service_id=service_id).order_by('-checked_at')[:limit]` — esta es la línea que se traduce a una consulta SQL real contra Postgres: "filtrá por este servicio, ordená del más nuevo al más viejo, traeme los primeros `limit`".

4. **Mismo archivo, línea 64.** `models = list(reversed(recent))` — da vuelta el orden, porque los algoritmos necesitan la lista del más viejo al más nuevo para que la búsqueda binaria y la bisección funcionen (ordenaron al revés en el paso 3 solo para que el `LIMIT` agarre justo los últimos N).

5. **`backend/infrastructure/models.py`, líneas 81-86.** Acá está la organización de la tabla que hace rápido el paso 3: `indexes = [models.Index(fields=['service', '-checked_at'], name='check_results_svc_at_idx')]` — esto no lo ejecuta ningún algoritmo directamente, es una instrucción para Postgres, aplicada mediante la migración `backend/infrastructure/migrations/0007_check_results_composite_index.py`, que le dice a la base de datos "guardá los datos ya organizados por servicio y por fecha, para que el paso 3 no tenga que ordenar nada al momento de la consulta".

Sin esa organización de la línea 84-86, Postgres tenía que filtrar por servicio (paso 3) y después ordenar el resultado en memoria cada vez que alguien pedía la pantalla de un servicio — con una tabla de 500 millones de filas totales, eso se nota. Con el índice, la base de datos ya tiene los datos pre-ordenados y entrega el resultado directo.

## La pregunta de fondo: "¿qué pasa si cambio una variable sin querer?"

Ningún caso rompe el sistema con un error — el riesgo siempre es el mismo: **el número que se muestra en pantalla deja de reflejar la realidad**, de forma silenciosa. Todas las variables mencionadas en este documento (los distintos `window` de cada archivo, `tier_a1`/`tier_d`/`tier_n`, `critical_ms`) están en la firma de su función respectiva, con su archivo y línea señalados arriba — nunca escondidas en medio de un cálculo. Pero cambiar cualquiera de ellas sin entender su efecto en el recorrido completo (no solo en la línea que se toca, sino en todo lo que esa línea alimenta después) sí tiene consecuencia real, aunque no se note en el momento.
