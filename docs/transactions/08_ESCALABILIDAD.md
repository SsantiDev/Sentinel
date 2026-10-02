# 8. Escalabilidad y concurrencia

Pregunta típica: *"¿y si hay 1.000, 10.000 o 1.000.000 de usuarios al mismo
tiempo, funciona bien?"*. Hay que separar **dos cosas distintas**:

## A) Rendimiento del algoritmo (¿aguanta muchos datos?)

Esto **sí lo probamos** con tests automáticos.

- El detector recorre las transacciones de cada usuario **una sola vez** por
  ventana (dos marcadores) y las ordena por fecha. Es prácticamente **lineal**
  respecto a la cantidad de transacciones.
- Test `test_transaction_scale.py`:
  - **200.000 transacciones** (2.000 usuarios × 100) se procesan en **menos de
    1 segundo**.
  - **1.000 ráfagas** simultáneas (1.000 usuarios con anomalía) se detectan
    todas correctamente.

> Conclusión: procesar millones de transacciones es cuestión de tiempo lineal;
> el algoritmo no se degrada ni se "confunde" entre usuarios.

Para correr estos tests (están marcados como lentos):
```bash
cd backend
pytest -m slow tests/integration/test_transaction_scale.py
```

## B) Concurrencia real (muchas peticiones HTTP a la vez)

Esto **no se prueba con tests unitarios** — depende de la **infraestructura**,
no del algoritmo. "1 millón de usuarios al mismo tiempo" se resuelve así:

| Pieza | Cómo escala |
|---|---|
| **Servidor web (Gunicorn)** | Más *workers* y más réplicas del contenedor detrás de Nginx. |
| **Base de datos (PostgreSQL)** | Índices (ya los tenemos: por usuario+fecha), *pooling* de conexiones, réplicas de lectura. |
| **Ingesta por lotes** | El endpoint acepta **listas**: enviar 1.000 transacciones en 1 petición pesa mucho menos que 1.000 peticiones. |
| **Throttling** | Protege de picos abusivos sin tumbar el servicio. |
| **Procesamiento pesado** | Si hiciera falta, la detección se puede mover a una tarea en segundo plano (Celery, que el proyecto ya usa). |

### Cómo hacer una prueba de carga real

Con la app corriendo, se usa una herramienta de carga (no tests). Ejemplo con
**k6**:

```javascript
// load_test.js
import http from 'k6/http'
export const options = { vus: 500, duration: '30s' }  // 500 usuarios virtuales
export default function () {
  const payload = JSON.stringify({
    idTxn: Math.floor(Math.random() * 1e9),
    user: `u${__VU}@x.com`,
    date: '2026-09-23T21:00:01',
    value: 100, paymentMethod: 'Tarjeta',
    hash: '...' // calculado como en 06_BOT_EVALUADOR.md
  })
  http.post('http://TU_HOST:8000/api/v1/transactions/', payload,
            { headers: { 'Content-Type': 'application/json' } })
}
```
```bash
k6 run load_test.js
```

Esto mide peticiones/segundo, latencia y errores bajo carga — que es lo que
responde de verdad "¿aguanta X usuarios a la vez?".

## Resumen honesto

- **Algoritmo**: probado, lineal, aguanta volúmenes grandes. ✅
- **Concurrencia de red**: no se mide con los tests actuales; es tema de
  infraestructura (workers, DB, réplicas) y se valida con una herramienta de
  carga como k6 o Locust. Está **preparado** para ello (ingesta por lotes,
  índices, throttling, Celery disponible), pero no se ha ejecutado una prueba
  de 1M de conexiones reales en este entorno.
