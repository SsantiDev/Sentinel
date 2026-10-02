# 4. Cómo mostrarlo desde el front

Esta guía dice **"esta funcionalidad se puede ver al momento de X"**, para que
en la exposición sepas exactamente dónde señalar.

## Antes de empezar

- El dashboard está en la ruta **`/anomalies`**.
- Solo lo ve un usuario **superusuario** (está protegido). Con un usuario
  normal **no aparece** el ítem en el menú.
- Para que haya algo que mostrar, primero **envía transacciones** por el POST
  (ver `06_BOT_EVALUADOR.md`): manda un lote normal y un lote anómalo.

## Dónde se ve cada requisito

| Requisito del enunciado | Se ve al momento de… |
|---|---|
| **Recibir transacciones por POST** | Enviar el POST con Postman/curl. La respuesta muestra `accepted`, `rejected` y `anomalies_detected`. (No es una pantalla del front; es el backend respondiendo.) |
| **Validar el hash** | Enviar una transacción con un hash incorrecto: la respuesta la lista en `rejected` con motivo `INVALID_HASH`, y **no** aparece en el dashboard. |
| **Total de transacciones (hoy/semana/mes)** | Entrar a `/anomalies`: tarjeta de la parte superior ("transacciones este mes" en el subtítulo). |
| **Total de anomalías (hoy/semana/mes)** | Tarjeta **"Anomalías hoy"** (con "esta semana" debajo). |
| **Porcentaje de transacciones con anomalías** | Tarjeta **"Tasa de anomalías"**. |
| **Valor total de transacciones sospechosas** | Tarjeta **"Valor sospechoso"** (en pesos). |
| **Usuarios afectados / recurrentes** | Tarjeta **"Usuarios afectados"**. Los recurrentes salen en las estadísticas. |
| **Promedio de transacciones por usuario** | En el subtítulo de la tarjeta "Valor sospechoso". |
| **Anomalías por nivel** | Panel **"Anomalías por nivel"** (barras: alto / medio / bajo). |
| **Métodos de pago** | Panel **"Métodos de pago"** (barras por Tarjeta, Efectivo, etc.). |
| **Distribución por hora (intensidad)** | Gráfica de barras **"Distribución por hora"** (24 horas). |
| **Evolución temporal / tendencias / picos** | Gráfica de líneas **"Evolución diaria"** (transacciones vs anomalías). |
| **Anomalías abiertas / revisadas / descartadas** | En la **tabla**: cada fila tiene su estado, y los botones permiten marcar "revisada" o "descartar". |
| **Línea de tiempo de una anomalía** | Hacer **clic en una fila** de la tabla → se abre un **modal** con la ventana deslizante y los puntos de cada transacción. |
| **Visualización de la ventana deslizante** | Es ese mismo modal: la barra representa la ventana, y cada punto es una transacción dentro de ella. |

## Recorrido sugerido (lo que harías en pantalla)

1. **Inicia sesión** con el usuario superusuario.
2. En el menú lateral, haz clic en **"Anomalías"** (ícono de triángulo de
   alerta). → *Aquí se demuestra que la sección existe y está protegida.*
3. Señala las **4 tarjetas** de arriba. → *Totales, tasa, valor sospechoso,
   usuarios afectados.*
4. Baja a los dos **paneles de desglose**: nivel y métodos de pago.
5. Muestra las **dos gráficas**: por hora y evolución diaria.
6. En la **tabla**, señala la columna de **valor**, **nivel** y **estado**.
7. Haz clic en una fila → se abre la **línea de tiempo** (la ventana
   deslizante dibujada). → *Este es el punto estrella de la demo.*
8. Cierra el modal y usa un botón de **"revisar"** o **"descartar"** en una
   fila → el estado cambia al instante.

## Si quieres datos de ejemplo rápido

Envía primero un lote anómalo de noche (por ejemplo 4–5 transacciones del
mismo usuario entre las 21:00:00 y 21:00:04) y un par de usuarios normales.
Así el dashboard se ve "con vida": tarjetas con números, barras y una fila en
la tabla para abrir la línea de tiempo.
