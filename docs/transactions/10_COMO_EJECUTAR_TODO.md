# 10. Guía rápida — Cómo ejecutar TODO (paso a paso)

Esta es **la guía principal**. Sigue los pasos en orden y tendrás el proyecto
corriendo y con una **URL pública** (Cloudflare) para la sustentación.

> Resumen en una frase: bajar los cambios → copiar `.env` → `docker compose up`
> → exponer con Cloudflare → generar TXNS.
>
> **Las migraciones y el superusuario se crean solos** al levantar Docker.
> Usuario por defecto: **admin / admin12345**.

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

## 2. Copiar el archivo `backend/.env`

Solo cópialo del ejemplo (ya trae todo listo: settings local, base de datos,
redis y las credenciales del superusuario). **No necesitas editar nada.**

```bash
# Windows (PowerShell o CMD):
copy backend\.env.example backend\.env

# Mac / Linux:
cp backend/.env.example backend/.env
```

> (Opcional) Si quieres, cambia `SECRET_KEY` o las credenciales
> `DJANGO_SUPERUSER_*` dentro de `backend/.env`.

---

## 3. Levantar todo con Docker

Desde la **raíz** del proyecto (donde está `docker-compose.yml`):

```bash
docker compose up --build -d
```

Esto levanta base de datos, redis, backend, worker, beat y nginx **y además**:
- aplica las **migraciones** automáticamente,
- crea el **superusuario** `admin / admin12345` (si no existe).

La app queda en **http://localhost**.

> `-d` lo deja en segundo plano. Para ver el progreso: `docker compose logs -f web`
> (verás "Applying ..." de las migraciones y "Superuser created").

---

## 4. Abrir la app en local

Abre en el navegador: **http://localhost** e inicia sesión:

- Usuario: **admin**  ·  Clave: **admin12345**
- Menú **"Transacciones"**: generar transacciones desde el front.
- Menú **"Anomalías"** (solo superusuario): el dashboard.

---

## 5. Exponer con Cloudflare (URL pública, sin login)

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

## 6. Validar que el POST entra (antes de exponer al evaluador)

```bash
curl -i -X POST https://TU-URL.trycloudflare.com/api/v1/transactions/ \
  -H "Content-Type: application/json" -d "{}"
```
Debe responder **422** con `"accepted": 0` y un `rejected` (el cuerpo vacio es
valido pero no entra ninguna). Eso confirma que el POST **llega** al backend.
Una transaccion bien firmada responderia **201**.

---

## 7. Generar transacciones (TXNS) para la demo

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

## 8. Qué mostrar en la sustentación

1. Generar TXNS (script o front).
2. Entrar a **"Anomalías"** y mostrar: tarjetas, valor sospechoso, anomalías por
   nivel, métodos de pago, distribución por hora, evolución diaria, y la
   **línea de tiempo** de una anomalía (clic en una fila de la tabla).
3. Explicar el **hash** (integridad) y que el endpoint es **abierto** pero
   protegido.

(Recorrido pantalla por pantalla: `04_COMO_MOSTRARLO_EN_EL_FRONT.md`.)

---

## 9. Comandos útiles

```bash
docker compose logs -f web     # ver logs del backend
docker compose exec web pytest # correr las pruebas dentro del contenedor
docker compose down            # apagar todo
docker compose down -v         # apagar y BORRAR la base (empezar de cero)
```

---

## 10. Cómo pedírselo a Claude Code (que lo levante por ti)

Si quieres que Claude Code haga el montaje, abre el proyecto con Claude Code y
pégale esto:

> **"Lee `docs/transactions/10_COMO_EJECUTAR_TODO.md` y ejecútalo: copia
> `backend/.env.example` a `backend/.env` y levanta Docker con
> `docker compose up --build -d`. Verifica en los logs que las migraciones se
> aplicaron y el superusuario se creó. Luego dime el comando exacto de
> Cloudflare para exponerlo y un ejemplo de `scripts/generate_txns.py`."**

Como las migraciones y el superusuario (**admin / admin12345**) se crean solos,
Claude Code solo tiene que copiar el `.env` y levantar Docker.

---

## 11. Problemas comunes

| Síntoma | Causa / solución |
|---|---|
| `error: .env not found` al hacer `docker compose up` | No copiaste `backend/.env` (paso 2). |
| No puedo entrar / usuario inválido | Usa **admin / admin12345**. Si lo cambiaste en `.env`, usa esos. |
| El dashboard sale vacío | Aún no has generado TXNS (paso 7). |
| El POST da 400 `INVALID_BODY` | El cuerpo debe ser un objeto JSON o una lista. |
| Una TXN sale `INVALID_HASH` | El hash no coincide; usa el script o el front (calculan el hash correcto). |
| Errores de BD al arrancar | La base aún no estaba lista; `docker compose restart web` reintenta las migraciones. |
| La URL de Cloudflare dejó de servir | El túnel se cerró; vuelve a correr `cloudflared tunnel --url http://localhost:80` (da una URL nueva). |
