# Guía de prueba — Algoritmos aplicados en Sentinel

Flujo manual desde el frontend para verificar los 4 algoritmos, qué deberías observar en pantalla en cada caso, y qué pasa si cada algoritmo se implementa distinto (o no se aplica). Ver `docs/PLAN_ALGORITMOS.md` (plan) y `docs/ALGORITMOS_APLICADOS.md` (ubicación exacta en código) para el detalle técnico.

---

## Setup previo (una vez)

1. Backend arriba: `docker compose up -d --build` + `docker compose exec web python manage.py migrate`.
2. Frontend: `cd frontend && npm run dev` → `http://localhost:5173`.
3. Login con superusuario (`docker compose exec web python manage.py createsuperuser` si no tenés uno).
4. Crear **dos servicios** desde el dashboard:
   - **Servicio A ("sano")**: URL real que responde siempre (ej. `https://google.com`).
   - **Servicio B ("roto")**: URL inválida (ej. `https://esto-no-existe-123456.com`).
5. Entrar al detalle de cada uno y usar el botón "Ping" repetidas veces (10-20 clicks espaciados en el tiempo) para acumular historial, o dejar correr el sistema (ping automático cada 60s vía Celery Beat). Cuantos más checks acumulados, más clara la diferencia entre algoritmos.

Sin historial variado (checks up/down mezclados, latencia que cambia), los 4 algoritmos igual corren pero devuelven resultados triviales (tier siempre máximo, sin incidente, sin tendencia) — no vas a "sentir" la diferencia si el historial es todo idéntico.

---

## 1. Búsqueda (binaria vs lineal) + estadísticas de servicio

**Flujo de prueba:**
Entrar al detalle del Servicio A con 15+ checks acumulados. El badge de estadísticas se calcula automáticamente al cargar la página.

**Qué deberías ver/sentir:**
Badge o panel con uptime %, latencia promedio y p95 junto al estado del servicio. Aparece casi instantáneo — el cálculo es sobre una lista ya ordenada, no hay demora perceptible aunque haya cientos de checks.

**Qué pasa si se cambia o no se aplica:**
- **Si se usa siempre búsqueda lineal** (recorrer todo el historial) en vez de binaria para ubicar un check por timestamp: con el volumen actual de Sentinel (decenas/cientos de checks por servicio) el usuario no nota ninguna diferencia de velocidad — la pérdida es puramente académica (dejás de demostrar O(log n) vs O(n)). Si el historial creciera a decenas de miles de checks sin paginar, ahí sí se notaría demora al buscar un instante puntual.
- **Si se depende solo del ORM/índice de Postgres** para todo (que es lo que ya hace Sentinel para filtrado normal): funcionalmente correcto y más rápido en producción real, pero no demuestra el algoritmo manual — por eso el plan separa "ORM resuelve el caso real" de "algoritmo manual es la pieza académica reportada aparte".
- **Si la lista no está ordenada por `checked_at` antes de aplicar búsqueda binaria**: el algoritmo da resultados incorrectos silenciosamente (búsqueda binaria requiere orden como precondición). Es el error más peligroso de este punto: no explota, devuelve un dato equivocado.

---

## 2. Recursión (divide y vencer) — inicio de incidente

**Flujo de prueba:**
Entrar al detalle del Servicio B (roto) después de que el último check haya sido "down" y exista una racha de fallos consecutivos.

**Qué deberías ver/sentir:**
Un banner o aviso visible SOLO cuando el servicio está caído ahora mismo, indicando desde cuándo empezó la caída (timestamp del primer check down de la racha activa). Si el último check es "up", el banner no debe aparecer — no hay incidente activo.

**Qué pasa si se cambia o no se aplica:**
- **Si se recorre linealmente desde el final** en vez de bisección recursiva: mismo resultado correcto, pero con historial grande (miles de checks) hace más operaciones — de nuevo, diferencia de rendimiento no perceptible al usuario con el volumen actual; la pérdida es solo dejar de demostrar O(log n).
- **Si la recursión no respeta la precondición** (racha continua de "down" hasta el último check, sin altibajos): el algoritmo puede devolver un punto de inicio incorrecto si hubo un "up" suelto en medio de la caída. Esto es un bug de lógica, no de rendimiento — hay que dejarlo documentado como límite conocido, no "arreglarlo" ignorando la precondición.
- **Si falta caso base o la recursión no reduce el rango en cada llamada**: stack overflow o loop infinito con historiales largos. Es el riesgo típico de implementar recursión mal, no específico de este dominio.
- **Si no se implementa nada de esto**: Sentinel vuelve a su comportamiento actual — registra cada ping individual pero nunca deriva "desde cuándo" algo está caído. El usuario tendría que revisar el historial completo a mano para saberlo.

---

## 3. Progresión aritmética — tiers de confiabilidad

**Flujo de prueba:**
Comparar el badge de tier entre Servicio A (uptime alto, cercano a 100%) y Servicio B (uptime bajo, con varios down). Si es posible, generar un tercer servicio con uptime intermedio (mezcla de up/down) para ver un tier intermedio.

**Qué deberías ver/sentir:**
Badge con nombre de tier (Bronze/Silver/Gold/Platinum por defecto) que cambia según el % de uptime acumulado del servicio — no es un valor fijo, se recalcula con cada carga de la página según el historial real.

**Qué pasa si se cambia o no se aplica:**
- **Si los umbrales (`a1`, `d`, `n`) se hardcodean** en vez de recibirse como parámetros de la función: sigue funcionando igual desde la UI, pero pierde flexibilidad (no se puede ajustar el sistema de tiers sin tocar código) y no cumple el criterio académico exigido — el punto del ejercicio es demostrar progresión aritmética parametrizable, no una tabla fija de if/else.
- **Si se usa progresión geométrica en vez de aritmética** (umbrales tipo `a1, a1*r, a1*r²...` en vez de `a1, a1+d, a1+2d...`): los umbrales dejan de estar equiespaciados — los tiers altos quedarían mucho más separados entre sí que los bajos (o viceversa), cambiando el significado de "subir de nivel". No es intercambiable con progresión aritmética, es otro algoritmo con otra semántica.
- **Si no se aplica ninguna clasificación**: Sentinel vuelve a mostrar solo el uptime % crudo, sin ninguna capa de interpretación rápida ("¿está bien o mal este número?") — el usuario tiene que juzgar el porcentaje a ojo.

---

## 4. Regresión lineal — predicción de degradación

**Flujo de prueba:**
Necesita un servicio con latencia que suba de forma consistente en los últimos checks (difícil de forzar con `https://google.com`, que responde rápido y estable). Alternativa: forzar varios pings seguidos a un servicio que empiece a responder cada vez más lento, o sembrar datos de prueba controlados si el objetivo es solo verificar el cálculo (ver sección de tests automatizados en `GUIA_SENTINEL.md`).

**Qué deberías ver/sentir:**
Card o indicador de tendencia de latencia. Con latencia estable, debería mostrar algo como "estable" sin alarma. Con latencia subiendo de forma sostenida, debería mostrar la pendiente y una proyección de en cuántos checks más se cruzaría un umbral crítico — esto es lo que lo distingue de una alerta reactiva: avisa ANTES de que el servicio caiga, no después.

**Qué pasa si se cambia o no se aplica:**
- **Si se calcula la tendencia como diferencia simple entre primer y último punto** (en vez de mínimos cuadrados sobre toda la ventana): el resultado se vuelve sensible al ruido — un solo pico o caída puntual de latencia en el primer o último check distorsiona toda la proyección, aunque la tendencia real del conjunto sea otra. Mínimos cuadrados usa todos los puntos, es más robusto a outliers.
- **Si se usa una librería de ML** en vez de la regresión manual: el resultado numérico puede terminar siendo equivalente, pero se pierde el objetivo académico de mostrar el cálculo manual (medias, numerador/denominador de la pendiente) y se agrega una dependencia pesada para un cálculo que no la necesita.
- **Si no se aplica ninguna predicción**: Sentinel se queda con alertas puramente reactivas (`consecutive_failures`, `latency_above` ya ocurrido) — nunca avisa de una degradación progresiva hasta que el servicio ya está mal, que es exactamente el hueco que este algoritmo llena.

---

## Resumen — mínimo para ver los 4 a la vez

1 servicio sano con 15+ pings acumulados (tier + estadísticas) + 1 servicio roto con 5+ pings fallidos consecutivos (incidente activo) + tiempo suficiente para que el ping automático (cada 60s) acumule variación natural de latencia en el sano (tendencia). Sin este mínimo de volumen y variedad de datos, los endpoints responden pero con resultados triviales que no muestran la diferencia real de cada algoritmo.
