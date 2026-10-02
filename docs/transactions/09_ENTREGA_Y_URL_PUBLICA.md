# 9. Entrega / Sustentación — URL pública y generación de TXNS

Guía práctica para el día de la sustentación: levantar todo, exponerlo con una
URL pública y generar transacciones (TXNS) para la demo.

## 1. Levantar el proyecto (Docker)

```bash
cd Sentinel/backend
cp .env.example .env
```

Edita `backend/.env` y asegúrate de tener estas dos líneas (clave para local):

```bash
DJANGO_SETTINGS_MODULE=config.settings.local
SECRET_KEY=pon-algo-largo-y-aleatorio-1234567890
```

> Sin `DJANGO_SETTINGS_MODULE=config.settings.local`, el backend arranca en
> modo producción y **redirige a HTTPS**, lo que rompe las pruebas por HTTP
> (incluido ngrok).

Levanta todo y prepara la base:

```bash
cd ..
docker compose up --build -d
docker compose exec web python manage.py migrate
docker compose exec web python manage.py createsuperuser
```

La app queda en **http://localhost** (nginx) y la API en `http://localhost/api/v1/`.

## 2. Exponer con una URL pública

### Cloudflare Tunnel (recomendado — sin login)
```bash
cloudflared tunnel --url http://localhost:80
```
Imprime una URL `https://algo.trycloudflare.com`. No pide cuenta ni
autenticación (ideal en equipos empresariales). Guía detallada y comandos de
instalación en [10_COMO_EJECUTAR_TODO.md](10_COMO_EJECUTAR_TODO.md).

### Ngrok (alternativa)
```bash
ngrok http 80
```
Te da una URL tipo `https://abcd-123.ngrok-free.app`. Esa URL:
- Sirve la app en `/`
- Recibe los POST en `/api/v1/transactions/`

> El endpoint de ingesta **no tiene throttling**, así que acepta un flujo
> continuo de TXNS durante varios minutos sin bloquear.

### Validar que el POST entra (antes de la demo)
```bash
curl -i -X POST https://TU-SUBDOMINIO.ngrok-free.app/api/v1/transactions/ \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{}'
# Debe responder 201 con "accepted": 0 y un "rejected" (INVALID_PAYLOAD).
# Eso confirma que el POST LLEGA al backend.
```

## 3. Generar TXNS para la demo

Hay un script listo: `backend/scripts/generate_txns.py`. Calcula el hash igual
que el backend y envía transacciones normales + algunas ráfagas (anomalías).

```bash
cd backend

# Contra local
python scripts/generate_txns.py --url http://localhost --count 1000 --anomaly-users 8

# Contra la URL pública (como lo haría el evaluador)
python scripts/generate_txns.py --url https://TU-SUBDOMINIO.ngrok-free.app \
  --count 2000 --anomaly-users 10

# Modo "streaming" (una por petición), para demostrar la detección en vivo
python scripts/generate_txns.py --url http://localhost --count 300 \
  --anomaly-users 6 --batch-size 1 --delay 0.03
```

Al final imprime: **Aceptadas / Rechazadas / Anomalías detectadas**.

Opciones:
- `--count`: total de transacciones.
- `--anomaly-users`: cuántos usuarios hacen ráfaga (generan anomalías).
- `--batch-size`: TXNS por petición (`1` = streaming; el default agrupa).
- `--delay`: segundos entre peticiones (para "estirar" la generación).
- `--base-hour`: hora base (21 = noche → límite 3, la más fácil de disparar).

> Si quieres que el generador tarde ~2.5–7 min (como pide el enunciado), sube
> `--count` y/o usa `--batch-size 1 --delay`.

## 4. Qué mostrar en la sustentación

1. **Generar TXNS** con el script (o desde el front, menú **"Transacciones"**).
2. Entrar como superusuario a **"Anomalías"** y mostrar:
   - Tarjetas (totales, tasa, valor sospechoso).
   - Anomalías por nivel y métodos de pago.
   - Distribución por hora y evolución diaria.
   - La **tabla** y, al hacer clic, la **línea de tiempo de la ventana**.
3. Explicar el **hash** (integridad) y que el endpoint es **abierto** pero
   protegido (ver `05_SEGURIDAD.md`).

## Checklist antes de exponer

- [ ] `docker compose up` corriendo (db, redis, web, worker, beat, nginx).
- [ ] `.env` con `DJANGO_SETTINGS_MODULE=config.settings.local`.
- [ ] Migraciones aplicadas y superusuario creado.
- [ ] `ngrok http 80` activo y URL pública a la mano.
- [ ] `curl` de validación responde 201.
- [ ] El generador corre y el dashboard muestra anomalías.
