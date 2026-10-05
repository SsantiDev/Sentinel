# 1. ¿Qué hace el sistema? (sin tecnicismos)

## El problema

Imagina un sistema de pagos. La mayoría de las personas hacen una compra de
vez en cuando. Pero un comportamiento **sospechoso** es cuando **un mismo
usuario hace muchas transacciones en muy poco tiempo** — por ejemplo, 3 pagos
en 3 segundos. Eso puede ser:

- Una tarjeta robada que alguien está "quemando" rápido.
- Un bot haciendo pagos automáticos.
- Un error que duplica cobros.

Queremos **detectar eso automáticamente** y avisar.

## La idea: "ventana deslizante"

Piensa en una **ventana de tiempo** de pocos segundos (por ejemplo, 3
segundos) que se va **deslizando** sobre la línea de tiempo de cada usuario.

En cada momento nos preguntamos:

> ¿Cuántas transacciones de **este mismo usuario** caben dentro de esos
> últimos 3 segundos?

Si caben **demasiadas** (más de lo permitido), levantamos una alerta.

```
Usuario b@b.com:

10:00:01   •
10:00:02   •     ← 3 transacciones dentro de una ventana de 3 segundos
10:00:03   •        ¡POSIBLE ANOMALÍA!


Usuario c@c.com:

10:00:01   •
10:00:10        •   ← las transacciones están separadas,
10:01:20                 •   nunca hay muchas juntas → NORMAL
```

## Cada usuario tiene su propia ventana

Muy importante: **las ventanas no se mezclan**. Si tres usuarios distintos
hacen una transacción al mismo tiempo, **no** es anomalía, porque cada uno
tiene su propia línea de tiempo:

```
Usuario 1 > 10:00:01   → su ventana
Usuario 2 > 10:00:02   → su ventana
Usuario 3 > 10:00:03   → su ventana
```

## El límite cambia según la hora del día

No todas las horas son iguales. En horas pico se esperan más transacciones,
y de madrugada muy pocas. Por eso el **límite es configurable por franja**:

| Franja | Horario | Límite (transacciones) |
|---|---|---|
| Mañana | 05:00:01 – 12:00:00 | 10 |
| Tarde-noche | 12:00:01 – 20:00:00 | 6 |
| Noche-madrugada | 20:00:01 – 05:00:00 | 3 |

Es decir: de madrugada basta con 3 transacciones juntas para sospechar; en la
mañana se toleran hasta 10. Estos números se pueden cambiar.

## ¿Y el "hash"?

Cada transacción llega con una **huella digital** (un *hash*). Es como un
sello que se calcula a partir de los datos de la transacción. El sistema
**recalcula** ese sello y lo compara: si no coinciden, significa que los datos
**fueron alterados en el camino** y la transacción se **rechaza**. Esto
garantiza **integridad** (que nadie cambió el monto o el usuario).

## Qué entrega al final

- Guarda las transacciones válidas.
- Marca las que forman parte de una anomalía.
- Genera **estadísticas** (totales, porcentajes, valor sospechoso, etc.).
- Lo muestra todo en un **tablero** (dashboard) fácil de leer.
