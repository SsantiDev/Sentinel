# 2. Cómo funciona el flujo (paso a paso)

## El viaje de una transacción

Cuando llega una transacción (o un lote de varias), ocurre esto en orden:

```
   (1) Llega el POST con las transacciones
            │
            ▼
   (2) ¿El formato es válido?  ── no ──► se rechaza (INVALID_PAYLOAD)
            │ sí
            ▼
   (3) ¿El hash coincide?      ── no ──► se rechaza (INVALID_HASH)
            │ sí
            ▼
   (4) ¿El idTxn ya existía?   ── sí ──► se rechaza (DUPLICATE)
            │ no
            ▼
   (5) Se guarda la transacción
            │
            ▼
   (6) Se agrupan por usuario y se ORDENAN por fecha
            │
            ▼
   (7) Ventana deslizante por usuario:
       ¿hay demasiadas dentro de X segundos,
        según el límite de esa franja horaria?
            │ sí
            ▼
   (8) Se registra la ANOMALÍA (con nivel y valor total)
            │
            ▼
   (9) El dashboard muestra todo
```

## ¿Qué datos trae cada transacción?

```json
{
  "idTxn": 10001,
  "user": "aa@aa.com",
  "date": "2026-09-23T10:30:01.120",
  "value": 50000,
  "paymentMethod": "Tarjeta",
  "hash": "ec37a3a3e8e2566a6ae41d5c807d11db5be922a231d..."
}
```

- **idTxn**: identificador único de la transacción.
- **user**: el correo del usuario (cada uno tiene su ventana).
- **date**: fecha y hora exacta (sirve para ordenar y para la franja).
- **value**: el monto (sirve para el "valor sospechoso").
- **paymentMethod**: Tarjeta, Efectivo, Transferencia, PSE, Otro.
- **hash**: la huella de integridad.

## El paso clave: la ventana deslizante

Se usa una técnica de **dos marcadores** (uno al inicio y otro al final de la
ventana) que recorren las transacciones ya ordenadas de un usuario:

1. El marcador del final avanza transacción por transacción.
2. El marcador del inicio se mueve hacia adelante para que la ventana nunca
   cubra más de X segundos.
3. En cada paso se cuenta cuántas transacciones hay dentro de la ventana.
4. Si esa cantidad **alcanza el límite de la franja**, se registra una anomalía
   y se salta al final de esa ráfaga (para no contar la misma dos veces).

Esto es eficiente: recorre la lista **una sola vez**.

## El nivel de la anomalía

Según cuánto se pase del límite, la anomalía se clasifica:

- **Bajo (low)**: justo en el límite.
- **Medio (medium)**: pasa el límite a 1.5x.
- **Alto (high)**: dobla el límite o más.

## Ejemplos concretos (los casos del enunciado)

### Caso 1 — Usuario hace múltiples transacciones → ANOMALÍA

```
Usuario: b@b.com   (franja noche, límite 3)
21:00:01
21:00:02
21:00:03
→ 3 transacciones en 3 segundos → ANOMALÍA
```

### Caso 2 — Transacciones normales → NORMAL

```
Usuario: c@c.com
10:00:01
10:00:10
10:01:20
→ están separadas, nunca se juntan → NORMAL
```

### Caso 3 — Diferentes usuarios → NORMAL

```
Usuario 1 > 10:00:01
Usuario 2 > 10:00:02
Usuario 3 > 10:00:03
→ cada uno tiene su propia ventana → NORMAL (no se mezclan)
```

> ⚠️ Nota sobre las franjas: con los límites por defecto, el "3 en 3s" solo es
> anomalía en **franja noche** (20:00–05:00), porque en la mañana el límite es
> 10. Para reproducir el ejemplo del enunciado en horario de mañana, se baja
> el límite de la mañana en la configuración (`/detection-config/`).

## Dónde vive cada cosa en el código (referencia rápida)

| Qué | Archivo |
|---|---|
| Qué es una transacción / anomalía | `backend/domain/entities/transaction.py` |
| Cálculo y verificación del hash | `backend/application/use_cases/transaction_hash.py` |
| Franja horaria y su límite | `backend/application/use_cases/time_band.py` |
| La ventana deslizante | `backend/application/use_cases/detect_transaction_anomalies.py` |
| Orquestar la ingesta | `backend/application/use_cases/ingest_transactions.py` |
| Guardar/consultar en base de datos | `backend/infrastructure/repositories/transaction_repository.py` |
| El endpoint POST y el dashboard | `backend/interfaces/http/views/transaction_views.py` |
