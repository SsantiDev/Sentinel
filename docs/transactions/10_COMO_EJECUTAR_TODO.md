# 10. Guía rápida — Cómo ejecutar TODO (paso a paso)

Esta es **la guía principal**. Sigue los pasos en orden y tendrás el proyecto
corriendo y con una **URL pública** (Cloudflare) para la sustentación.

> Resumen en una frase: bajar los cambios → crear `.env` → `docker compose up`
> → migrar y crear superusuario → exponer con Cloudflare → generar TXNS.

---

## 0. Requisitos (instalar una sola vez)

- **Docker Desktop** (y que esté abierto/corriendo).
- **cloudflared** (para la URL pública):
  - Windows: `winget install --id Cloudflare.cloudflared`
    (o `choco install cloudflared`, o descarga el `.exe` de
    https://github.com/cloudflare/cloudflared/releases)
  - Mac: `brew install cloudflared`
  - Linux: ver https://pkg.cloudflare.com/

Verifica que quedó instalado:
```bash
cloudflared --version
```

---

## 1. Bajar los cambios

```bash
git checkout master
git pull origin master
```

---

## 2. Crear el archivo `backend/.env`

El proyecto necesita un archivo `backend/.env`. Pártelo del ejemplo:

```bash
# Windows (PowerShell o CMD):
copy backend\.env.example backend\.env

# Mac / Linux:
cp backend/.env.example backend/.env
```

Ahora **abre `backend/.env`** y asegúrate de que tenga estas dos líneas
(la primera es OBLIGATORIA para local; si no, te redirige a HTTPS y rompe el túnel):

```bash
DJANGO_SETTINGS_MODULE=config.settings.local
SECRET_KEY=pon-aqui-algo-largo-y-aleatorio-1234567890
```

El resto de valores del ejemplo (base de datos, redis) ya vienen listos para Docker.

---

## 3. Levantar todo con Docker

Desde la **raíz** del proyecto (donde está `docker-compose.yml`):

```bash
docker compose up --build -d
```

Esto levanta: base de datos, redis, backend (API), worker, beat y nginx.
La app queda en **http://localhost**.

> `-d` lo deja corriendo en segundo plano. Para ver logs: `docker compose logs -f web`

---

## 4. Preparar la base de datos y el usuario

```bash
docker compose exec web python manage.py migrate
docker compose exec web python manage.py createsuperuser
```

- `migrate` crea las tablas (incluidas las de transacciones). **No se hace solo.**
- `createsuperuser` crea el usuario con el que entrarás al dashboard de anomalías.

---

## 5. Abrir la app en local

Abre en el navegador: **http://localhost**

- Inicia sesión con el superusuario que creaste.
- Menú **"Transacciones"**: para generar transacciones desde el front.
- Menú **"Anomalías"** (solo superusuario): el dashboard.

---

## 6. Exponer con Cloudflare (URL pública, sin login)

En una terminal **aparte** (déjala abierta):

```bash
cloudflared tunnel --url http://localhost:80
```

Cloudflare imprimirá una línea como:

```
https://algo-aleatorio.trycloudflare.com
```

**Esa es tu URL pública.** Sirve la app en `/` y recibe los POST en
`/api/v1/transactions/`.

> Es un *quick tunnel*: no pide cuenta ni autenticación. La URL cambia cada vez
> que lo levantas (normal para la demo).

---

## 7. Validar que el POST entra (antes de exponer al evaluador)

```bash
curl -i -X POST https://TU-URL.trycloudflare.com/api/v1/transactions/ \
  -H "Content-Type: application/json" -d "{}"
```
Debe responder **201** con `"accepted": 0` y un `rejected`. Eso confirma que el
POST **llega** correctamente al backend.

---

## 8. Generar transacciones (TXNS) para la demo

Hay un script listo que calcula el hash igual que el backend y envía
transacciones normales + ráfagas (anomalías).

> Opción A — desde tu máquina (necesitas Python con `requests`):
```bash
cd backend
python scripts/generate_txns.py --url https://TU-URL.trycloudflare.com --count 2000 --anomaly-users 10
```

> Opción B — dentro del contenedor (sin instalar nada):
```bash
docker compose exec web python scripts/generate_txns.py --url http://localhost --count 2000 --anomaly-users 10
```

Al final imprime: **Aceptadas / Rechazadas / Anomalías detectadas**.

Opciones útiles: `--count` (total), `--anomaly-users` (cuántos hacen ráfaga),
`--batch-size 1` (streaming, de a una), `--delay 0.05` (pausa entre envíos),
`--base-hour 21` (noche → límite 3, la más fácil de disparar).

También puedes generar desde el front: menú **"Transacciones"** → "Simular ráfaga".

---

## 9. Qué mostrar en la sustentación

1. Generar TXNS (script o front).
2. Entrar a **"Anomalías"** y mostrar: tarjetas, valor sospechoso, anomalías por
   nivel, métodos de pago, distribución por hora, evolución diaria, y la
   **línea de tiempo** de una anomalía (clic en una fila de la tabla).
3. Explicar el **hash** (integridad) y que el endpoint es **abierto** pero
   protegido.

(Recorrido pantalla por pantalla: `04_COMO_MOSTRARLO_EN_EL_FRONT.md`.)

---

## 10. Comandos útiles

```bash
docker compose logs -f web     # ver logs del backend
docker compose exec web pytest # correr las pruebas dentro del contenedor
docker compose down            # apagar todo
docker compose down -v         # apagar y BORRAR la base (empezar de cero)
```

---

## 11. Cómo pedírselo a Claude Code (que lo levante por ti)

Si quieres que Claude Code haga el montaje, abre el proyecto con Claude Code y
pégale esto:

> **"Lee `docs/transactions/10_COMO_EJECUTAR_TODO.md` y ejecútalo paso a paso:
> crea `backend/.env` a partir de `.env.example` agregando
> `DJANGO_SETTINGS_MODULE=config.settings.local` y un `SECRET_KEY` aleatorio,
> levanta Docker (`docker compose up --build -d`), corre `migrate`, y luego
> detente y pregúntame el usuario y la clave para crear el superusuario.
> Al final dime el comando exacto de Cloudflare para exponerlo y cómo correr
> `scripts/generate_txns.py`."**

Claude Code ejecutará los comandos, te irá mostrando el resultado y se detendrá
donde necesite datos tuyos (como la clave del superusuario).

---

## 12. Problemas comunes

| Síntoma | Causa / solución |
|---|---|
| El navegador redirige a `https://localhost` y falla | Falta `DJANGO_SETTINGS_MODULE=config.settings.local` en `backend/.env`. |
| `error: .env not found` al hacer `docker compose up` | No creaste `backend/.env` (paso 2). |
| El dashboard sale vacío | Aún no has generado TXNS (paso 8). |
| El POST da 400 `INVALID_BODY` | El cuerpo debe ser un objeto JSON o una lista. |
| Una TXN sale `INVALID_HASH` | El hash no coincide; usa el script o el front (calculan el hash correcto). |
| `migrate` dice que faltan tablas / errores de BD | Corre `docker compose exec web python manage.py migrate`. |
| La URL de Cloudflare dejó de servir | El túnel se cerró; vuelve a correr `cloudflared tunnel --url http://localhost:80` (da una URL nueva). |
