# Pilas y colas en Sentinel (explicación para cualquier persona)

Sentinel vigila sitios web y servicios: cada minuto los "visita" para ver si están
funcionando y cuánto tardan en responder.

Este documento explica dos mejoras que se agregaron usando dos estructuras clásicas de
programación: una **cola** y una **pila**. Está escrito para que lo entienda alguien que
nunca programó. Lo único técnico que vas a ver son las rutas de archivo, para poder
encontrar cada cosa.

Documentos relacionados: `docs/ALGORITMOS_APLICADOS.md` y
`docs/COMO_FUNCIONAN_LOS_ALGORITMOS.md` (los otros cuatro cálculos del proyecto).

---

## Dos palabras que se repiten

**Cola.** Una fila de espera, como la del banco. El primero que llega es el primero que se
atiende. Se usa cuando hay muchas cosas por hacer y hay que atenderlas en orden.

**Pila.** Como el botón "deshacer" (Ctrl+Z) de cualquier programa. Lo último que hiciste es
lo primero que se revierte. Se usa cuando querés poder volver sobre tus pasos, de a uno.

**Cola de prioridad.** Una cola especial: no atiende por orden de llegada, sino al que está
peor o lleva más tiempo esperando, como una sala de urgencias.

---

# Mejora 1 — El turnero de revisiones (una cola de prioridad)

## Qué problema había

Cada sitio que vigilás tiene una configuración de "revísame cada tantos segundos" (por
defecto, cada 60). Podés poner un sitio en "cada 5 minutos" si no te urge tanto.

El problema: esa configuración no se respetaba. Cada minuto, Sentinel revisaba **todos**
los sitios activos al mismo tiempo, sin mirar cuál tocaba y cuál no. Un sitio puesto en
"cada 5 minutos" igual se revisaba cada minuto. Trabajo de más, y la configuración por
sitio no servía para nada.

## Qué hace ahora

Ahora, cada minuto, Sentinel arma una fila con todos los sitios ordenados por **quién
tiene el turno más atrasado**. Después atiende solo a los que ya les tocaba (los que
pasaron su tiempo de espera) y deja al resto para más adelante.

Es como una sala de espera donde se llama primero al que lleva más tiempo sentado. Un
sitio configurado "cada 5 minutos" que se revisó hace 1 minuto no entra en la tanda de
ahora: todavía le faltan 4 minutos para su turno. Uno configurado "cada 60 segundos"
entra en casi todas las tandas, porque su turno cae siempre dentro del minuto siguiente.

## Qué vas a notar

- Un sitio configurado "cada 5 minutos" se revisa cada 5 minutos, no cada 1.
- Menos revisiones innecesarias corriendo en segundo plano.
- Si mirás los registros del sistema, cada minuto queda anotado cuántos sitios estaban
  vencidos y se atendieron (por ejemplo: "3 de 20 servicios vencidos encolados").
- Un sitio recién agregado, que nunca se revisó, se atiende de inmediato en la próxima
  tanda.

## Cómo funciona por dentro

1. Un reloj interno dispara el turnero **cada minuto**.
   `backend/config/settings/base.py:72`
2. El turnero le pide a la base de datos, para cada sitio activo, tres datos: cuál es,
   cuándo fue su última revisión y cada cuánto quiere ser revisado.
   `backend/infrastructure/repositories/service_repository.py:71`
3. Con esos datos arma la cola de prioridad y saca los sitios cuyo turno cae de acá al
   próximo minuto (así un sitio de "cada 60 segundos" no se atrasa esperando la vuelta
   siguiente del reloj).
   `backend/application/use_cases/select_due_checks.py:17`
4. Cada sitio elegido se manda a revisar (esa parte no cambió: sigue entrando a la cola de
   trabajo de siempre).
   `backend/infrastructure/tasks/ping_tasks.py:47`

El "cómo tocaba a cuál" es una cola de prioridad de verdad: se meten todos los sitios de un
saque y después se van sacando de a uno, siempre el más atrasado primero, hasta que el
próximo de la fila todavía no esté por vencer. Ahí se corta.

## Rendimiento

Meter todos los sitios en la fila cuesta un paso por sitio. Sacar cada sitio vencido
cuesta muy poco (crece de forma logarítmica, no lineal). Como normalmente solo unos pocos
sitios están vencidos en cada minuto, el turnero hace bastante menos trabajo que ordenar la
lista completa cada vez. Las pruebas verifican esa cuenta de operaciones.

## Cómo probarlo

1. En la pantalla de un sitio, cambiá su intervalo a un valor alto (por ejemplo 300
   segundos).
2. Dejá corriendo el sistema unos minutos y mirá el historial de ese sitio: las revisiones
   nuevas deberían aparecer cada ~5 minutos, no cada minuto.
3. Un sitio con intervalo 60 sigue revisándose cada minuto, como siempre.

---

# Mejora 2 — Deshacer filtros en el historial (una pila)

## Qué problema había

En la pantalla de **Historial** podés filtrar la tabla haciendo clic en los títulos de las
columnas: por estado (funcionando / caído), por lentitud, por código de error, por fecha.
Cada clic cambia el filtro.

El problema: no había forma de "volver un paso atrás". Si aplicabas cuatro filtros y
querías deshacer solo el último, tenías que acordarte de cómo estaba antes y rehacerlo a
mano.

## Qué hace ahora

Hay un botón **"Deshacer filtro"** arriba de la tabla. Cada vez que cambiás un filtro, el
estado anterior se guarda en una pila (como el historial del Ctrl+Z). El botón saca el
último estado guardado y te devuelve a él. Si lo apretás varias veces, vas retrocediendo
filtro por filtro hasta volver a la tabla sin filtrar.

## Qué vas a notar

- Un botón nuevo "Deshacer filtro" arriba a la derecha, al lado del botón de CSV.
- Está apagado (gris) cuando no hay nada que deshacer.
- Cada clic te devuelve al filtro anterior, de a uno.
- Se recuerdan hasta 20 pasos hacia atrás. Si cambiás filtros más de 20 veces, se olvida
  el más viejo.
- Si salís de la pantalla de Historial y volvés, el historial de deshacer arranca de cero.

## Cómo funciona por dentro

1. La pila en sí (guardar, sacar, contar) vive en una pieza aparte y reutilizable.
   `frontend/src/application/hooks/useFilterStack.js`
2. Cuando cambiás un filtro, antes de aplicarlo se apila el estado actual.
   `frontend/src/application/hooks/useHistory.js:63`
3. El botón "Deshacer" saca el último estado apilado y lo vuelve a poner.
   `frontend/src/application/hooks/useHistory.js:72`
4. El botón en pantalla.
   `frontend/src/presentation/pages/HistoryPage.jsx:120`

Es una pila en el sentido estricto: lo último que entra es lo primero que sale. Guardar y
sacar son operaciones instantáneas (no dependen de cuántos pasos haya guardados).

## Nota de organización del código

La pantalla de Historial estaba cerca del límite de tamaño que el proyecto se pone por
archivo. Para agregar el botón sin pasarse, la parte de la paginación (los botones de
página 1, 2, 3...) se movió a su propio archivo.
`frontend/src/presentation/components/HistoryPagination.jsx`
El comportamiento de la paginación no cambió.

## Cómo probarlo

1. Entrá a **Historial**.
2. Hacé clic en el título "Estado" una o dos veces (filtra por funcionando / caído).
3. Hacé clic en "Latencia" y en "Fecha" para agregar más filtros.
4. Apretá "Deshacer filtro": volvés al filtro anterior.
5. Seguí apretando: retrocedés uno por uno hasta la tabla sin filtros. Ahí el botón se
   apaga.

---

# Qué se probó

**Turnero (backend):**

- 7 pruebas nuevas del cálculo de la cola de prioridad, todas pasan: un sitio nunca
  revisado siempre entra; solo entran los vencidos; salen en orden de prioridad; el
  margen de "próximo minuto" incluye lo que está por vencer pero respeta los intervalos
  largos; con lista vacía no pasa nada; la cuenta de operaciones se mantiene baja.
  `backend/tests/unit/test_select_due_checks.py`
- El resto de las pruebas del backend sigue igual (28 pasan; los 2 fallos que ya existían
  antes, en el texto de las alertas, no se tocaron y siguen igual).
- Revisión de estilo de código: sin observaciones en los archivos nuevos o modificados.
- Chequeo general de Django: sin problemas. No hizo falta ningún cambio en la base de
  datos.

**Deshacer filtros (frontend):**

- La aplicación compila sin errores.
- Revisión de estilo: los archivos nuevos quedan limpios. Los dos avisos que aparecen en
  archivos que toqué ya existían antes y no son de este trabajo.
- No se pudo probar a mano en el navegador en este entorno (no hay herramienta de
  navegador disponible). La lógica de la pila está cubierta por su propia estructura y la
  compilación valida que todo enlaza bien.

---

# Qué quedó pendiente o para revisar

## Pruebas que faltan hacer

- **Probar el turnero con el sistema corriendo de verdad** (con la base de datos y el
  reloj interno activos, dentro de Docker, dejándolo varios minutos). Acá se validó la
  lógica con pruebas automáticas y que todo enlaza bien, pero no una corrida real
  prolongada. Al momento de este trabajo el entorno local no tenía la base de datos
  accesible y Docker estaba ocupado por otro proyecto, así que la corrida real quedó
  pendiente.
- **Probar "Deshacer filtro" en el navegador**: hacer los clics reales y confirmar que el
  botón se apaga cuando no hay nada que deshacer y se prende al aplicar un filtro, y que
  retrocede en el orden correcto. No se pudo probar en pantalla porque este entorno no
  tiene herramienta de navegador.
- Confirmar el turnero con **sitios recién creados**: un sitio que nunca fue revisado se
  considera vencido y se atiende enseguida; es lo buscado, pero conviene verlo en vivo.

## Cosas del entorno de desarrollo

- El entorno local (`backend/.venv`) estaba incompleto: le faltaba una librería declarada
  (`django-anymail`), sin la cual las pruebas del backend no arrancan. Se instaló a mano.
  Si se recrea el entorno, reinstalar todas las dependencias de `requirements.txt`.
- La forma recomendada de correr las pruebas del backend sigue siendo dentro de Docker
  (`docker compose exec web pytest -q`), no en el entorno local.
- Los 2 fallos de prueba que aparecen (`test_ping_service_down_sends_alert` y
  `test_send_alert_message_contains_service_name`) son de arrastre, anteriores a este
  trabajo: el mensaje de alerta quedó en español y esas pruebas esperan el texto en
  inglés. No se tocó ese código.

## Números fáciles de ajustar si hiciera falta

- **Cada cuánto corre el turnero:** hoy cada 60 segundos.
  `backend/config/settings/base.py:72` (y el mismo valor como referencia en
  `backend/infrastructure/tasks/ping_tasks.py`, la constante `SCHEDULER_TICK_SECONDS`).
  Si se cambia uno, hay que cambiar el otro para que sigan coincidiendo.
- **Cuántos pasos de "deshacer" se recuerdan:** hoy 20.
  `frontend/src/application/hooks/useFilterStack.js` (la constante `MAX_DEPTH`).

## Ideas para más adelante (no incluidas en este trabajo)

- Las otras dos aplicaciones de colas que se evaluaron y no se hicieron: una cola que
  filtre alertas repetidas antes de enviarlas (para no recibir el mismo correo en cada
  ciclo) y una ventana fija de últimas revisiones en memoria para no consultar la base de
  datos en cada chequeo.
