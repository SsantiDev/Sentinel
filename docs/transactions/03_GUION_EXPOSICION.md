# 3. Guion para la exposición al profesor

Una guía de **7–10 minutos**. La idea es contar una historia clara: problema →
solución → demostración → seguridad.

---

## Parte 1 — El problema (1 min)

> "Queríamos detectar comportamientos sospechosos en pagos. El patrón que más
> delata un fraude es que **un mismo usuario haga muchas transacciones en muy
> poco tiempo**. Por ejemplo, 3 pagos en 3 segundos."

Muestra el dibujo de los puntos juntos vs. separados
(ver `01_QUE_HACE_EL_SISTEMA.md`).

## Parte 2 — La técnica: ventana deslizante (2 min)

> "Usamos una **ventana deslizante**: una ventana de pocos segundos que se
> mueve sobre la línea de tiempo de **cada usuario por separado**. Si dentro
> de la ventana caben más transacciones de las permitidas, es una anomalía."

Puntos clave para mencionar:
- Cada usuario tiene **su propia** ventana (no se mezclan).
- El límite **cambia según la hora** (mañana 10, tarde 6, noche 3), y es
  **configurable**.
- Antes de analizar, **verificamos el hash** de cada transacción para asegurar
  que los datos no fueron alterados.

## Parte 3 — Demostración en vivo (3–4 min)

1. **Enviar transacciones** con una herramienta (Postman, curl o un script).
   Ver `06_BOT_EVALUADOR.md` para el ejemplo listo para copiar.
   - Primero un caso **normal** (transacciones separadas) → la respuesta dice
     `anomalies_detected: 0`.
   - Luego un caso **anómalo** (3 seguidas de noche) → `anomalies_detected: 1`.

2. **Abrir el dashboard** en el navegador (`/anomalies`, con un usuario
   superusuario). Mostrar:
   - Las **tarjetas** de arriba (anomalías hoy, tasa, valor sospechoso…).
   - El **desglose por nivel** y por **método de pago**.
   - Las **gráficas** (distribución por hora y evolución diaria).
   - La **tabla** de anomalías. Hacer clic en una fila → se abre la
     **línea de tiempo** de esa anomalía (se ve la ventana con sus puntos).

Ver el detalle pantalla por pantalla en `04_COMO_MOSTRARLO_EN_EL_FRONT.md`.

## Parte 4 — Seguridad (1–2 min)

> "El endpoint de ingesta es **abierto** a propósito, para que pueda ser
> evaluado automáticamente. Pero lo protegimos: **hash de integridad** en cada
> transacción, **límite de peticiones** (throttling), **límite de tamaño** de
> lote y **cabeceras de seguridad** que mitigan las alertas típicas de
> herramientas como ZAP o Burp."

Ver `05_SEGURIDAD.md`.

## Parte 5 — Cierre (30 s)

> "El sistema cumple el objetivo: recibe transacciones por POST, las ordena,
> analiza cada usuario con ventana deslizante, valida el hash, registra
> anomalías, identifica usuarios recurrentes, genera estadísticas y lo muestra
> en un dashboard. Está construido con **arquitectura limpia** (capas
> separadas) y **probado con 65 tests automáticos**."

---

## Posibles preguntas del profesor (y respuestas cortas)

- **¿Por qué ventana deslizante y no contar por minuto fijo?**
  Porque una ventana fija "parte" las ráfagas que caen entre dos bloques. La
  ventana deslizante detecta la concentración real, caiga donde caiga.

- **¿Qué pasa si llegan desordenadas?**
  Las ordenamos por fecha antes de analizar.

- **¿El hash cifra los datos?**
  No. El hash garantiza **integridad** (que no se alteraron). La
  **confidencialidad** la da el transporte HTTPS. (Ver `05_SEGURIDAD.md`.)

- **¿Es escalable?**
  El algoritmo recorre las transacciones de cada usuario **una sola vez**
  (complejidad lineal), y la base de datos tiene índices por usuario y fecha.
