# El frontend, línea por línea: de abrir un servicio a ver sus analíticas

Este documento sigue **todo el código** que se ejecuta cuando entrás a la pantalla de
detalle de un servicio, desde que hacés clic hasta que aparecen la medalla, el aviso de
caída y el recuadro de tendencia.

No hace falta que sepas programar. Cada archivo se muestra con su código real y con
números de línea, y debajo hay una explicación **línea por línea**: qué hace esa línea,
qué decide, y **a dónde sigue** el recorrido después de ella.

Documentos hermanos:
- `docs/COMO_FUNCIONAN_LOS_ALGORITMOS.md` — qué hace el servidor con esos pedidos (los 4 cálculos).
- `docs/ALGORITMOS_APLICADOS.md` — detalle técnico y rendimiento de esos cálculos.

---

## Índice

- [Parte 0 — La idea que hay que entender antes de mirar código](#parte-0)
- [Parte 1 — El arranque de la aplicación](#parte-1)
- [Parte 2 — La pantalla: `ServiceDetailPage.jsx`](#parte-2)
- [Parte 3 — El ayudante de analíticas: `useServiceAnalytics.js`](#parte-3)
- [Parte 4 — El ayudante del servicio y su historial: `useServiceDetail.js`](#parte-4)
- [Parte 5 — El cartero: `apiClient.js`](#parte-5)
- [Parte 6 — La credencial: `authStorage.js`](#parte-6)
- [Parte 7 — Los componentes que dibujan el resultado](#parte-7)
- [Parte 8 — El salto al servidor](#parte-8)
- [Parte 9 — El recorrido completo, en orden](#parte-9)
- [Apéndice — Glosario de términos](#apendice)

---

<a name="parte-0"></a>

## Parte 0 — La idea que hay que entender antes de mirar código

Hay **una sola idea** que, si no está clara, hace que todo lo demás parezca magia. Es esta:

> **La pantalla no "recibe" los datos. La pantalla se vuelve a ejecutar entera, y cada vez
> vuelve a leer los datos que haya en ese momento.**

### Cómo funciona una pantalla en React

React es la librería con la que está hecho el frontend. En React, una "pantalla" (o un
"componente") es **una función que devuelve la descripción de lo que hay que dibujar**.

React ejecuta esa función:

1. Una vez cuando la pantalla aparece.
2. Otra vez, completa, **cada vez que cambia algún dato guardado** (lo que en React se
   llama *estado*; en este documento le decimos "cajón").

Cada vez que la función se ejecuta se llama un **render** ("dibujado").

### El truco de los cajones (estado)

Un cajón es un espacio de memoria que **sobrevive** entre un render y el siguiente. Se crea
con `useState`. Te da dos cosas: el contenido actual del cajón, y una función para
cambiarlo.

Cuando llamás a esa función de cambio (`setStats(...)`, por ejemplo), pasan dos cosas:
- el cajón queda con el valor nuevo;
- React **vuelve a ejecutar la pantalla** desde la primera línea.

En ese nuevo render, la línea que lee el cajón devuelve el valor nuevo. Nadie "avisó" a la
pantalla: simplemente se ejecutó de nuevo y leyó lo que había.

### Aplicado a nuestro caso

Cuando abrís `/services/42`:

- **Render 1.** La pantalla se ejecuta. Le pregunta al ayudante de analíticas "¿qué tenés?"
  y el ayudante responde "nada todavía" (`stats`, `incident`, `trend` valen `null`). La
  pantalla dibuja la versión gris (el *esqueleto*). En paralelo, el ayudante dispara los
  pedidos al servidor y se queda esperando.
- *(pasan unos milisegundos)*
- El servidor responde. El ayudante guarda cada respuesta en su cajón con `setStats`,
  `setIncident`, `setTrend`.
- **Render 2.** Guardar en los cajones obligó a React a re-ejecutar la pantalla. Esta vez,
  cuando la pantalla le pregunta al ayudante "¿qué tenés?", el ayudante responde con los
  datos reales. La pantalla dibuja la medalla, el aviso y el recuadro de tendencia.

Todo el resto de este documento es el detalle de esos dos renders.

### Un diagrama de la cadena

```
  URL /services/42
        │
        ▼
  ServiceDetailPage.jsx        (la pantalla: solo dibuja)
        │  llama a los ayudantes con id = "42"
        ├──────────────► useServiceDetail.js      (trae el servicio + su historial)
        └──────────────► useServiceAnalytics.js   (trae stats + incidente + tendencia)
                                │  cada pedido pasa por...
                                ▼
                         apiClient.js             (el cartero: agrega /api/v1 + credencial)
                                │  lee la credencial de...
                                ▼
                         authStorage.js           (el token guardado en el navegador)
                                │  sale a la red
                                ▼
                         SERVIDOR  /api/v1/services/42/stats|incidents|trend/
                                │  responde JSON
                                ▼
                         useServiceAnalytics.js   (guarda en los cajones -> nuevo render)
                                │
                                ▼
  ServiceDetailPage.jsx (render 2)  reparte los datos a...
        ├──► ReliabilityBadge.jsx   (la medalla)
        ├──► IncidentBanner.jsx     (el aviso rojo de caída)
        └──► TrendIndicator.jsx     (el recuadro de tendencia)
```

---

<a name="parte-1"></a>

## Parte 1 — El arranque de la aplicación

Antes de que exista la pantalla de detalle, la aplicación tiene que arrancar y saber que la
dirección `/services/42` corresponde a esa pantalla.

### 1.1 `frontend/src/main.jsx` — el punto de entrada

```jsx
 1  import { StrictMode } from 'react'
 2  import { createRoot } from 'react-dom/client'
 3  import './index.css'
 4  import './infrastructure/i18n'
 5  import App from './App'
 6
 7  createRoot(document.getElementById('root')).render(
 8    <StrictMode>
 9      <App />
10    </StrictMode>
11  )
```

- **L1** — trae `StrictMode`, una envoltura de React que, **solo en desarrollo**, ejecuta
  cierto código dos veces para destapar errores. (Por eso, corriendo local, a veces vas a
  ver dos pedidos al servidor en lugar de uno. En producción no pasa.)
- **L2** — trae `createRoot`, la función que "engancha" React a un pedazo del HTML.
- **L3** — carga los estilos globales.
- **L4** — carga la configuración de idiomas (i18n). Es lo que después permite que
  `IncidentBanner` y `TrendIndicator` muestren textos traducidos.
- **L5** — trae el componente `App` (el archivo de al lado). **→ sigue en 1.2.**
- **L7** — busca en el HTML el elemento con `id="root"` (un `<div>` vacío) y le dice a React
  "vas a dibujar acá adentro".
- **L8-10** — le entrega `App` envuelto en `StrictMode`. A partir de acá React toma el
  control y ejecuta `App`.

### 1.2 `frontend/src/App.jsx` — el mapa de direcciones (el router)

Este archivo define **qué pantalla corresponde a cada dirección**.

```jsx
 1  import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
 2  import { ThemeProvider } from './application/context/ThemeContext'
 3  import { LandingPage } from './presentation/pages/LandingPage'
 4  import { LoginPage } from './presentation/pages/LoginPage'
 5  import { DashboardPage } from './presentation/pages/DashboardPage'
 6  import { ServiceDetailPage } from './presentation/pages/ServiceDetailPage'
 7  import { AlertsPage } from './presentation/pages/AlertsPage'
 8  import { HistoryPage } from './presentation/pages/HistoryPage'
 9  import { SettingsPage } from './presentation/pages/SettingsPage'
10  import { getToken } from './infrastructure/authStorage'
11  import { Layout } from './presentation/components/Layout'
12  import { useAuth } from './application/hooks/useAuth'
13  import { AdminUsersPage } from './presentation/pages/AdminUsersPage'
14  import { RegisterPage } from './presentation/pages/RegisterPage'
15  import { VerifyEmailPage } from './presentation/pages/VerifyEmailPage'
16  import { ForgotPasswordPage } from './presentation/pages/ForgotPasswordPage'
17  import { ResetPasswordPage } from './presentation/pages/ResetPasswordPage'
18
19  function ProtectedRoute({ children }) {
20    return getToken() ? <Layout>{children}</Layout> : <Navigate to="/login" replace />
21  }
```

- **L1** — trae las piezas de `react-router-dom`, la librería que conecta la barra de
  direcciones del navegador con las pantallas:
  - `BrowserRouter` — el que escucha los cambios de dirección.
  - `Routes` / `Route` — la lista de "dirección → pantalla".
  - `Navigate` — un redireccionamiento hecho desde el código.
- **L2-17** — traen cada pantalla y algunas piezas de apoyo. La que nos importa es la
  **L6**: `ServiceDetailPage`, la pantalla que este documento sigue.
- **L10** — trae `getToken` para poder revisar si hay sesión iniciada. **→ ver Parte 6.**
- **L19-21** — `ProtectedRoute` es una envoltura para las pantallas que **exigen sesión**:
  - **L20** — si `getToken()` devuelve algo (hay credencial guardada), dibuja la pantalla
    pedida (`children`) dentro del `Layout` (la barra lateral + el marco). Si no hay
    credencial, **redirige a `/login`** y no dibuja nada más. `replace` significa "no dejes
    la página anterior en el historial del navegador", así el botón Atrás no vuelve a una
    pantalla protegida.

```jsx
30  export default function App() {
31    return (
32      <ThemeProvider>
33        <BrowserRouter>
34          <Routes>
35            <Route path="/" element={<LandingPage />} />
36            <Route path="/login" element={<LoginPage />} />
37            <Route path="/register" element={<RegisterPage />} />
38            <Route path="/verify-email" element={<VerifyEmailPage />} />
39            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
40            <Route path="/reset-password" element={<ResetPasswordPage />} />
41            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
42            <Route path="/services/:id" element={<ProtectedRoute><ServiceDetailPage /></ProtectedRoute>} />
43            <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
44            <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
45            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
46            <Route path="/admin" element={<SuperProtectedRoute><AdminUsersPage /></SuperProtectedRoute>} />
47          </Routes>
48        </BrowserRouter>
49      </ThemeProvider>
50    )
51  }
```

- **L32** — `ThemeProvider` deja disponible el tema (claro/oscuro) para toda la app.
- **L33** — `BrowserRouter` empieza a vigilar la barra de direcciones.
- **L34** — `Routes` elige **una sola** de las líneas de abajo: la primera cuyo `path`
  coincide con la dirección actual.
- **L42** — **la línea clave para este documento.**
  - `path="/services/:id"` — los dos puntos en `:id` significan "acá va un valor
    variable". `/services/42`, `/services/7`, `/services/999` coinciden todos con esta
    línea; la parte que cambia queda guardada con el nombre `id`.
  - `element={<ProtectedRoute><ServiceDetailPage /></ProtectedRoute>}` — si hay sesión,
    dibuja `ServiceDetailPage`. **→ sigue en la Parte 2.**
  - Ese `id` que salió de la dirección lo va a leer la pantalla en su línea 201.

**Resumen de la Parte 1:** el navegador está en `/services/42` → el router elige la
línea 42 → confirma que hay sesión → dibuja `ServiceDetailPage`.

---

<a name="parte-2"></a>

## Parte 2 — La pantalla: `frontend/src/presentation/pages/ServiceDetailPage.jsx`

Este archivo tiene 357 líneas, pero solo una parte maneja el flujo de datos. Lo vemos por
tramos.

### 2.1 Los imports (líneas 1 a 12)

```jsx
 1  import { memo, useDeferredValue, useMemo, useState } from 'react'
 2  import { useParams, useNavigate } from 'react-router-dom'
 3  import { ArrowLeft, RefreshCw, Clock, Search, ChevronDown, ChevronUp, Power } from 'lucide-react'
 4  import { useServiceDetail } from '../../application/hooks/useServiceDetail'
 5  import { useServiceAnalytics } from '../../application/hooks/useServiceAnalytics'
 6  import { StatusBadge } from '../components/StatusBadge'
 7  import { LatencyChart } from '../components/LatencyChart'
 8  import { StatusTimeline } from '../components/StatusTimeline'
 9  import { ReliabilityBadge } from '../components/ReliabilityBadge'
10  import { IncidentBanner } from '../components/IncidentBanner'
11  import { TrendIndicator } from '../components/TrendIndicator'
12  import { cn } from '../../infrastructure/utils'
```

- **L1** — herramientas de React que usa la pantalla:
  - `memo` — envuelve un componente para que **no se vuelva a dibujar** si sus datos de
    entrada no cambiaron (optimización; se usa en la tabla de historial).
  - `useDeferredValue` — permite que un valor "se atrase" a propósito para que escribir en
    un filtro no trabe la pantalla.
  - `useMemo` — recuerda el resultado de un cálculo y solo lo rehace si cambian sus
    ingredientes.
  - `useState` — crea un cajón (ver Parte 0).
- **L2** — `useParams` (leer la parte variable de la dirección) y `useNavigate` (cambiar de
  dirección desde el código).
- **L3** — íconos.
- **L4** — trae el **ayudante del servicio y su historial**. **→ Parte 4.**
- **L5** — trae el **ayudante de analíticas**. **→ Parte 3.**
- **L6-11** — los componentes que dibujan cada pedacito. Los tres que nos importan:
  `ReliabilityBadge` (L9), `IncidentBanner` (L10), `TrendIndicator` (L11). **→ Parte 7.**
- **L12** — `cn`, una utilidad para unir nombres de estilos de forma condicional.

Ninguna línea de import "hace" algo todavía: solo dejan disponibles esas piezas.

### 2.2 Dos componentes de apoyo (líneas 14 a 198) — resumen

Antes de la pantalla principal, el archivo define dos piezas que **no participan del flujo
de datos**, solo lo dibujan:

- **`ServiceDetailSkeleton` (líneas 14-85)** — la versión gris y vacía de la pantalla. Es
  puro dibujo: recuadros con la forma pero sin ningún número. Se muestra mientras se están
  esperando los datos.
- **`ServiceHistoryTable` (líneas 87-198)** — la tabla de historial de la derecha. Recibe
  la lista `history` como dato de entrada y maneja **su propio** orden y filtro por
  dentro. Está envuelta en `memo` (L87), así que solo se vuelve a dibujar cuando cambia
  `history`, no cada vez que la pantalla padre se redibuja por otra razón.

### 2.3 La pantalla principal: declaración de datos (líneas 200 a 216)

```jsx
200  export function ServiceDetailPage() {
201    const { id } = useParams()
202    const navigate = useNavigate()
203    const { service, history, loading, ping, toggleStatus } = useServiceDetail(id)
204    const { stats: analyticsStats, incident, trend } = useServiceAnalytics(id)
205
206    const [isPinging, setIsPinging] = useState(false)
207    const [isToggling, setIsToggling] = useState(false)
208    const [toggleTargetActive, setToggleTargetActive] = useState(null)
209
210    const stats = useMemo(() => {
211      if (!history || history.length === 0) return null
212      const upCount = history.filter(h => h.status === 'up').length
213      const uptime = ((upCount / history.length) * 100).toFixed(2)
214      const outages = history.filter(h => h.status === 'down').length
215      return { uptime, outages }
216    }, [history])
```

- **L200** — se define la función de la pantalla. **React la ejecuta entera en cada
  render** (ver Parte 0). Todo lo que sigue vuelve a correr cada vez.
- **L201** — `useParams()` devuelve un objeto con las partes variables de la dirección. La
  ruta era `/services/:id` (App.jsx L42), así que en `/services/42` esto deja
  `id === "42"`. **Siempre es texto**, nunca número. **→ este `id` alimenta las L203 y
  L204.**
- **L202** — `useNavigate()` devuelve la función `navigate`, para saltar a otra dirección.
  Se usa en el botón "volver" (L252: `navigate('/dashboard')`).
- **L203** — **llama al ayudante del servicio** pasándole el `id`. El ayudante devuelve un
  objeto y esta línea lo **desarma** en cinco nombres: `service` (los datos del servicio),
  `history` (la lista de revisiones), `loading` (el cartel de "cargando"), `ping` y
  `toggleStatus` (dos acciones). **→ corre todo el archivo de la Parte 4; volvé acá con lo
  que devuelve su línea 67.**
- **L204** — **llama al ayudante de analíticas** pasándole el mismo `id`. Desarma su
  respuesta en tres nombres: `stats` renombrado a `analyticsStats` (`stats: analyticsStats`
  significa "tomá el campo `stats` y llamalo `analyticsStats` acá"), `incident` y `trend`.
  Fijate que **no toma** el `loading` ni el `refetch` de este ayudante: no le hacen falta.
  **→ corre todo el archivo de la Parte 3; volvé acá con lo que devuelve su línea 31.**
- **L206-208** — tres cajones locales que **solo afectan a los botones**:
  - `isPinging` — ¿hay un ping en curso? (para poner el botón a girar).
  - `isToggling` — ¿se está activando/desactivando el servicio?
  - `toggleTargetActive` — ¿hacia qué estado vamos? (para el texto "Activando..." vs
    "Desactivando...").
  Todos arrancan "apagados" (`false` / `null`).
- **L210-216** — `stats` (ojo: **otro** `stats`, calculado acá, distinto del
  `analyticsStats` del servidor).
  - `useMemo(() => { ... }, [history])` — "calculá esto una vez y guardá el resultado;
    rehacelo solo si cambia `history`".
  - **L211** — si todavía no hay historial, el resultado es `null`.
  - **L212** — cuenta cuántas revisiones de la lista tienen estado `'up'`.
  - **L213** — ese conteo dividido por el total, en porcentaje, con 2 decimales. Es la
    disponibilidad calculada **en el navegador**.
  - **L214** — cuenta cuántas tienen estado `'down'`.
  - **L215** — devuelve `{ uptime, outages }`.

> **Aclaración importante — hay dos "uptime":**
> - `stats.uptime` (esta L213): lo calcula el navegador con las revisiones que ya cargó
>   `useServiceDetail` (el historial visible).
> - `analyticsStats` (del servidor, L204): lo calcula el backend con hasta 500 revisiones y
>   además trae el promedio, el p95 y la medalla.
> Los dos números de disponibilidad pueden no coincidir exactamente porque miran ventanas
> distintas. En pantalla, el recuadro "Uptime" usa el del navegador (L307); la medalla usa
> el del servidor (L261).

### 2.4 Las dos acciones de los botones (líneas 218 a 238)

```jsx
218    const handlePing = async () => {
219      if (!service?.is_active || isPinging) return
220      setIsPinging(true)
221      try {
222        await ping()
223      } finally {
224        setIsPinging(false)
225      }
226    }
227
228    const handleToggleStatus = async () => {
229      if (!service || isToggling) return
230      setToggleTargetActive(!service.is_active)
231      setIsToggling(true)
232      try {
233        await toggleStatus()
234      } finally {
235        setIsToggling(false)
236        setToggleTargetActive(null)
237      }
238    }
```

- **L218-226** — `handlePing` envuelve la acción `ping` que vino del ayudante (L203).
  - **L219** — si el servicio está inactivo, o ya hay un ping corriendo, no hace nada.
  - **L220** — enciende el cajón `isPinging` → nuevo render → el botón se pone a girar y
    dice "Ejecutando...".
  - **L222** — `await ping()` — ejecuta la acción del ayudante y espera a que termine.
    **→ useServiceDetail.js L42.**
  - **L224** — pase lo que pase, apaga `isPinging` → el botón vuelve a la normalidad.
- **L228-238** — `handleToggleStatus` envuelve la acción `toggleStatus` (L203).
  - **L230** — guarda hacia qué estado vamos (lo contrario del actual), para el texto.
  - **L231** — enciende `isToggling` → el botón gira.
  - **L233** — `await toggleStatus()`. **→ useServiceDetail.js L30.**
  - **L235-236** — apaga los dos cajones.

Estas dos funciones **se definen** en cada render pero **no se ejecutan** hasta que hacés
clic en el botón correspondiente (ver L269 y L287).

### 2.5 El corte: esqueleto o pantalla real (líneas 240 a 246)

```jsx
240    if (loading) {
241      return <ServiceDetailSkeleton />
242    }
243
244    if (!service) return null
245
246    return (
```

- **L240-242** — **si `loading` es `true`, dibuja el esqueleto gris y termina acá.** Nada
  de lo que sigue se ejecuta en este render. Ese `loading` es el de `useServiceDetail`
  (L203), **no** el de analíticas.
  - Esto explica por qué la medalla, el aviso y la tendencia nunca "parpadean vacíos" en la
    pantalla real: hasta que el servicio y su historial no llegaron, no se dibuja nada más
    que el esqueleto.
- **L244** — si terminó de cargar pero `service` sigue vacío (por ejemplo el servidor
  respondió "no existe"), no dibuja nada.
- **L246** — a partir de acá se arma la pantalla de verdad.

### 2.6 Dónde se dibuja cada dato (líneas 246 a 349)

Solo señalamos las líneas donde **un dato del flujo** entra a un componente.

```jsx
259              <h2 ...>{service.name}</h2>
260              <StatusBadge status={service.is_active ? service.status : 'inactive'} />
261              <ReliabilityBadge tier={analyticsStats?.reliability_tier} />
263            <p ...>{service.url}</p>
...
268            <button onClick={handleToggleStatus} disabled={isToggling} ...>
...
286            <button onClick={handlePing} disabled={!service.is_active || isPinging} ...>
...
301        <IncidentBanner incident={incident} />
...
307            <p ...>{stats?.uptime || '100'}%</p>
311            <p ...>{stats?.outages || '0'}</p>
315            <p ...>{service.check_interval_seconds}s</p>
317          <TrendIndicator trend={trend} />
...
327              <LatencyChart history={history} />
...
337            <StatusTimeline history={history} limit={50} />
...
345          <ServiceHistoryTable history={history} />
```

- **L259** — el nombre del servicio, de `service.name` (ayudante de la Parte 4).
- **L260** — la etiqueta de estado (funcionando / caído / inactivo).
- **L261** — **la medalla.** Le pasa `analyticsStats?.reliability_tier` al componente
  `ReliabilityBadge`.
  - El `?.` significa "si `analyticsStats` es `null`, no explotes: dame `undefined`".
  - En el **render 1**, `analyticsStats` es `null` → el componente recibe `undefined` →
    **no dibuja nada** (ver Parte 7, `ReliabilityBadge` L12).
  - En el **render 2** (ya llegó la respuesta), `analyticsStats` es el objeto del servidor
    → el componente recibe `"Gold"` (o el que sea) → dibuja la píldora dorada.
  - **→ ReliabilityBadge.jsx.**
- **L268** — el botón de activar/desactivar. `onClick={handleToggleStatus}` conecta el clic
  con la función de la L228. `disabled={isToggling}` lo apaga mientras la acción corre.
- **L286** — el botón "Ejecutar Ping". `onClick={handlePing}` → L218.
- **L301** — **el aviso rojo de caída.** Le pasa `incident` (ayudante de la Parte 3) a
  `IncidentBanner`. Mismo mecanismo: render 1 recibe `null` y no dibuja; render 2 recibe el
  objeto y, **solo si** `active_incident` es verdadero, muestra la barra roja.
  **→ IncidentBanner.jsx.**
- **L307** — el recuadro "Uptime": `stats?.uptime` (el cálculo del navegador, L210). El
  `|| '100'` es "si no hay dato, mostrá 100".
- **L311** — el recuadro "Outages": `stats?.outages`.
- **L315** — el recuadro "Frecuencia": `service.check_interval_seconds`, directo del
  servicio.
- **L317** — **el recuadro de tendencia.** Le pasa `trend` (ayudante de la Parte 3) a
  `TrendIndicator`. Render 1: `null`, no dibuja. Render 2: el objeto; si `has_data` es
  verdadero, muestra la pendiente y (si está empeorando) el pronóstico.
  **→ TrendIndicator.jsx.**
- **L327** — el gráfico de latencia recibe `history`.
- **L337** — la línea de tiempo de disponibilidad recibe `history` (y `limit={50}`: solo
  los últimos 50).
- **L345** — la tabla de historial recibe `history`.

### 2.7 Un ícono hecho a mano (líneas 351 a 357)

```jsx
351  function Activity({ className, size }) {
352    return (
353      <svg ... >
354        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
355      </svg>
356    )
357  }
```

- `Activity` es un ícono dibujado a mano dentro del archivo (no viene de la librería de
  íconos; fijate que en la L3 no está importado). Se usa en el título "Latencia en tiempo
  real" (L324). No tiene nada que ver con el flujo de datos.

---

<a name="parte-3"></a>

## Parte 3 — El ayudante de analíticas: `frontend/src/application/hooks/useServiceAnalytics.js`

Este es el archivo que la pantalla llamó en su línea 204. Trae **las tres analíticas**.

```jsx
 1  import { useState, useEffect, useCallback } from 'react'
 2  import apiClient from '../../infrastructure/apiClient'
 3
 4  export function useServiceAnalytics(id) {
 5    const [stats, setStats] = useState(null)
 6    const [incident, setIncident] = useState(null)
 7    const [trend, setTrend] = useState(null)
 8    const [loading, setLoading] = useState(true)
 9
10    const fetch = useCallback(async () => {
11      if (!id || id === 'undefined') return
12      setLoading(true)
13      try {
14        const [statsRes, incidentRes, trendRes] = await Promise.all([
15          apiClient.get(`/services/${id}/stats/`),
16          apiClient.get(`/services/${id}/incidents/`),
17          apiClient.get(`/services/${id}/trend/`),
18        ])
19        setStats(statsRes.data)
20        setIncident(incidentRes.data)
21        setTrend(trendRes.data)
22      } finally {
23        setLoading(false)
24      }
25    }, [id])
26
27    useEffect(() => {
28      fetch()
29    }, [fetch])
30
31    return { stats, incident, trend, loading, refetch: fetch }
32  }
```

Línea por línea:

- **L1** — trae tres herramientas de React:
  - `useState` — crea un cajón.
  - `useEffect` — "ejecutá esto **después** de que la pantalla se dibuje", no durante.
  - `useCallback` — "recordá esta función; no la vuelvas a fabricar en cada render, salvo
    que cambien sus ingredientes". Importa para la L27.
- **L2** — trae el cartero. **→ Parte 5.**
- **L4** — define el ayudante. Recibe `id` (el número del servicio que le pasó la pantalla).
  Todo el cuerpo se ejecuta en **cada render de la pantalla**, pero los cajones conservan su
  contenido.
- **L5** — cajón `stats`. Empieza `null` (vacío). `setStats` es la única forma de
  cambiarlo, y hacerlo dispara un nuevo render de la pantalla.
- **L6** — cajón `incident`. Empieza vacío.
- **L7** — cajón `trend`. Empieza vacío.
- **L8** — cajón `loading`. Empieza en `true`: se asume "todavía cargando" hasta que
  vuelvan las respuestas.
- **L10** — define `fetch`, la función que realmente pide al servidor.
  - `async` — adentro hay esperas (`await`).
  - `useCallback(..., [id])` — devuelve **la misma** función `fetch` en todos los renders,
    hasta que cambie `id`; ahí fabrica una nueva. (Esto es lo que hace que la L27 vuelva a
    disparar cuando cambiás de servicio.)
- **L11** — **guardia.** Si no hay `id`, o si el router entregó el texto literal
  `'undefined'`, se sale de `fetch` sin pedir nada. Evita disparar pedidos hacia un
  servicio que no existe.
- **L12** — enciende `loading` (por si esto es una recarga posterior).
- **L13** — abre un `try ... finally`: pase lo que pase adentro del `try`, el bloque
  `finally` (L22) se ejecuta siempre.
- **L14** — **el corazón del ayudante.**
  - `Promise.all([A, B, C])` — arranca A, B y C **al mismo tiempo** y espera a que las tres
    terminen. Si fueran tres `await` separados, uno abajo del otro, la pantalla tardaría la
    **suma** de los tres; así tarda lo que tarde **el más lento**.
  - `await` — frena la función acá hasta que las tres respuestas estén.
  - `const [statsRes, incidentRes, trendRes] =` — cuando llegan, reparte las tres
    respuestas, en orden, a esos tres nombres.
- **L15** — pedido 1: `apiClient.get('/services/<id>/stats/')`.
  - `` `/services/${id}/stats/` `` — texto con un hueco: `${id}` se reemplaza por el número.
    Con `id = "42"` queda `/services/42/stats/`.
  - **→ pasa por apiClient.js L6 (le agregan `/api/v1` y la credencial) y sale a la red
    hacia `GET /api/v1/services/42/stats/`.** El servidor devuelve algo como
    `{ uptime_pct, avg_latency_ms, p95_latency_ms, reliability_tier, ... }`.
- **L16** — pedido 2: `/services/<id>/incidents/`. El servidor devuelve
  `{ active_incident: true/false, started_at, ... }`.
- **L17** — pedido 3: `/services/<id>/trend/`. El servidor devuelve
  `{ has_data, is_degrading, slope_ms_per_check, predicted_checks_to_breach }`.
- **L19** — `setStats(statsRes.data)` — guarda el **cuerpo** de la respuesta 1 en el cajón
  `stats`. `.data` es el JSON que mandó el servidor (axios lo pone ahí). **→ dispara un
  nuevo render de la pantalla.**
- **L20** — igual con `incident`.
- **L21** — igual con `trend`. (React junta estos tres cambios en **un solo** render, no
  tres.)
- **L22-24** — `finally`: pase lo que pase, apaga `loading`.
- **L25** — `[id]` es la lista de ingredientes de `useCallback` (L10): `fetch` se vuelve a
  fabricar **solo** cuando cambia `id`.
- **L27-29** — `useEffect(() => { fetch() }, [fetch])`:
  - se ejecuta **una vez** justo después del primer render de la pantalla → llama a
    `fetch()` → arranca todo el pedido.
  - `[fetch]` es su lista de ingredientes: se vuelve a ejecutar **cada vez que `fetch`
    cambia**. Y `fetch` cambia (por la L25) cuando cambia `id`. Resultado: abrís la
    pantalla → pide; navegás a otro servicio → vuelve a pedir con el número nuevo.
- **L31** — **lo que el ayudante le devuelve a la pantalla:** un objeto con el contenido de
  los tres cajones (`stats`, `incident`, `trend`), el cartel `loading`, y `refetch` (que es
  el mismo `fetch`, renombrado, por si la pantalla quisiera volver a pedir a mano).
  **→ vuelve a ServiceDetailPage.jsx L204.**

**Qué se lleva la pantalla de acá:** solo `stats` (como `analyticsStats`), `incident` y
`trend`. En el render 1 los tres son `null`; en el render 2 los tres tienen el JSON del
servidor.

---

<a name="parte-4"></a>

## Parte 4 — El ayudante del servicio y su historial: `frontend/src/application/hooks/useServiceDetail.js`

Es el archivo que la pantalla llamó en su línea 203. Trae **el servicio y su historial**, y
además define las acciones **ping** y **activar/desactivar**.

```jsx
 1  import { useState, useEffect, useCallback } from 'react'
 2  import apiClient from '../../infrastructure/apiClient'
 3
 4  export function useServiceDetail(id) {
 5    const [service, setService] = useState(null)
 6    const [history, setHistory] = useState([])
 7    const [loading, setLoading] = useState(true)
 8
 9    const fetch = useCallback(async (silent = false) => {
10      if (!silent) setLoading(true)
11      try {
12        const [svc, hist] = await Promise.all([
13          apiClient.get(`/services/${id}/`),
14          apiClient.get(`/services/${id}/history/`),
15        ])
16        setService(svc.data)
17        setHistory(hist.data)
18        return { service: svc.data, history: hist.data }
19      } finally {
20        if (!silent) setLoading(false)
21      }
22    }, [id])
23
24    useEffect(() => {
25      if (id && id !== 'undefined') {
26        fetch()
27      }
28    }, [fetch, id])
```

- **L1-2** — lo mismo que el otro ayudante: herramientas de React y el cartero.
- **L4** — define el ayudante. Recibe `id`.
- **L5** — cajón `service`: un objeto (nombre, url, `is_active`, `status`,
  `check_interval_seconds`, ...). Empieza `null`.
- **L6** — cajón `history`: una **lista**. Empieza `[]` (lista vacía).
- **L7** — cajón `loading`. Empieza `true`. **Este es el `loading` que gobierna el
  esqueleto** de la pantalla (ServiceDetailPage L240).
- **L9** — define `fetch`. Novedad: recibe `silent` (por defecto `false`).
  - `silent = false` → recarga "visible": muestra el esqueleto mientras pide.
  - `silent = true` → recarga "por lo bajo": trae datos nuevos sin hacer parpadear la
    pantalla. Lo usan `ping` y `toggleStatus`.
- **L10** — si **no** es silenciosa, enciende `loading` (aparece el esqueleto).
- **L12-15** — dos pedidos en paralelo:
  - **L13** — `GET /services/<id>/` → los datos del servicio.
  - **L14** — `GET /services/<id>/history/` → la lista de revisiones.
  - **→ los dos pasan por apiClient.js L6.**
- **L16** — guarda el servicio en su cajón. → nuevo render.
- **L17** — guarda el historial en su cajón. → nuevo render.
- **L18** — **además** devuelve los dos datos como resultado de `fetch`. Esto es para que
  quien llamó a `fetch` (por ejemplo `ping`, L53) pueda leer los datos **frescos al toque**,
  sin esperar al siguiente render.
- **L19-21** — `finally`: si no era silenciosa, apaga `loading` (desaparece el esqueleto).
- **L22** — `[id]`: `fetch` se vuelve a fabricar solo si cambia `id`.
- **L24-28** — `useEffect`: en el primer render y cada vez que cambie `fetch` **o** `id`
  (L28), si el `id` es válido (L25), llama a `fetch()`. Es lo que dispara la carga al abrir
  la pantalla.

```jsx
30    const toggleStatus = async () => {
31      if (!service) return
32      try {
33        await apiClient.patch(`/services/${id}/`, {
34          is_active: !service.is_active
35        })
36        await fetch(true)
37      } catch (e) {
38        console.error('Error toggling status:', e)
39      }
40    }
```

- **L30** — define `toggleStatus`: activar o desactivar el servicio.
- **L31** — si todavía no hay servicio cargado, no hace nada.
- **L33-35** — `apiClient.patch('/services/<id>/', { is_active: ... })`:
  - `patch` = "modificá **parte** de este registro" (a diferencia de traerlo o borrarlo).
  - `{ is_active: !service.is_active }` — manda el estado **contrario** al actual (`!`
    significa "lo opuesto"). Si estaba activo, pide desactivarlo, y al revés.
  - **→ sale a `PATCH /api/v1/services/<id>/`.**
- **L36** — `await fetch(true)` — recarga silenciosa: vuelve a traer el servicio ya con el
  estado nuevo, sin parpadeo.
- **L37-39** — si algo falla, lo anota en la consola del navegador y no rompe la pantalla.

```jsx
42    const ping = async () => {
43      if (!id) return
44      const previousCheckedAt = history?.[0]?.checked_at || null
45      await apiClient.post(`/services/${id}/ping/`)
46
47      const maxWaitMs = 15000
48      const intervalMs = 1000
49      let elapsed = 0
50
51      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
52      const hasNewEntry = async () => {
53        const result = await fetch(true)
54        const latestCheckedAt = result?.history?.[0]?.checked_at || null
55        return latestCheckedAt && latestCheckedAt !== previousCheckedAt
56      }
57
58      if (await hasNewEntry()) return
59
60      while (elapsed < maxWaitMs) {
61        await sleep(intervalMs)
62        elapsed += intervalMs
63        if (await hasNewEntry()) return
64      }
65    }
```

- **L42** — define `ping`: forzar una revisión **ahora** y esperar a que aparezca su
  resultado.
- **L43** — sin `id`, no hace nada.
- **L44** — anota la fecha/hora de la revisión más nueva que hay ahora mismo
  (`history[0].checked_at`). El `?.` y el `|| null` son "si no hay nada, usá `null` en vez
  de romper". Sirve como punto de comparación en la L55.
- **L45** — `apiClient.post('/services/<id>/ping/')`:
  - `post` = "ejecutá esta acción".
  - **→ sale a `POST /api/v1/services/<id>/ping/`**; el servidor hace la revisión.
- **L47-49** — límites de la espera: como mucho 15000 ms (15 s), revisando cada 1000 ms
  (1 s). `elapsed` lleva la cuenta del tiempo ya esperado.
- **L51** — `sleep` — una pausa que se puede `await`. `setTimeout` avisa después de `ms`
  milisegundos; envuelto en una `Promise` para poder esperarlo.
- **L52-56** — `hasNewEntry` — "¿ya llegó la revisión nueva?":
  - **L53** — recarga silenciosa y **usa el valor devuelto** (L18), no el cajón.
  - **L54** — mira la fecha/hora de la revisión más nueva de ese resultado.
  - **L55** — devuelve verdadero si esa fecha existe **y** es distinta de la que anotamos
    en la L44 (o sea: apareció una revisión que antes no estaba).
- **L58** — prueba una vez enseguida; si la revisión ya está, listo.
- **L60-64** — si no, entra en un bucle: espera 1 s (L61), suma ese segundo a `elapsed`
  (L62), vuelve a preguntar (L63). Corta cuando aparece la revisión nueva o cuando se
  cumplen los 15 s.

```jsx
67    return { service, history, loading, ping, toggleStatus }
68  }
```

- **L67** — **lo que devuelve a la pantalla:** los tres cajones (`service`, `history`,
  `loading`) y las dos acciones (`ping`, `toggleStatus`). **→ vuelve a
  ServiceDetailPage.jsx L203.**

---

<a name="parte-5"></a>

## Parte 5 — El cartero: `frontend/src/infrastructure/apiClient.js`

Todos los `apiClient.get/post/patch` de los dos ayudantes pasan por acá. Es **una sola
pieza compartida**: los dos ayudantes importan el mismo objeto.

```jsx
 1  import axios from 'axios'
 2  import { getToken } from './authStorage'
 3
 4  const apiClient = axios.create({ baseURL: '/api/v1' })
 5
 6  apiClient.interceptors.request.use((config) => {
 7    const token = getToken()
 8    if (token) config.headers.Authorization = `Bearer ${token}`
 9    return config
10  })
11
12  apiClient.interceptors.response.use(
13    (response) => response,
14    (error) => {
15      if (error.response?.status === 401) {
16        localStorage.removeItem('sentinel_token')
17        window.location.href = '/login'
18      }
19      return Promise.reject(error)
20    }
21  )
22
23  export default apiClient
```

- **L1** — trae `axios`, la librería que hace los pedidos HTTP (hablar con el servidor por
  la web).
- **L2** — trae `getToken` para leer la credencial guardada. **→ Parte 6.**
- **L4** — **crea el cartero.** `baseURL: '/api/v1'` significa que a **toda** dirección que
  le pases se le pega `/api/v1` adelante. Por eso los ayudantes escriben
  `/services/42/stats/` y el pedido real sale a `/api/v1/services/42/stats/`.
- **L6-10** — **checkpoint de salida** (`interceptors.request`): cada pedido pasa por acá
  **antes** de salir.
  - **L7** — lee el token.
  - **L8** — si hay, le agrega al pedido el encabezado
    `Authorization: Bearer <token>`. Es el "carnet" que el backend revisa para saber quién
    sos. `Bearer` es la palabra estándar que va antes del token.
  - **L9** — devuelve la configuración del pedido (ya modificada) para que siga su camino y
    salga a la red.
- **L12-21** — **checkpoint de vuelta** (`interceptors.response`): cada respuesta pasa por
  acá **al volver**.
  - **L13** — si es una respuesta normal, la deja pasar tal cual.
  - **L14-20** — si es un error:
    - **L15** — ¿el error es "401"? (el servidor dice: "tu credencial falta, venció o no
      sirve").
    - **L16** — borra el token guardado (ya no vale).
    - **L17** — **`window.location.href = '/login'`: manda todo el navegador a la pantalla
      de inicio de sesión.** No es una navegación suave: la aplicación se recarga entera en
      `/login`. **Este es el "hacia dónde redirige" cuando la sesión se cae.**
    - **L19** — vuelve a lanzar el error para que quien pidió también se entere de que
      falló.
- **L23** — **exporta el único cartero**, para que los dos ayudantes (y todo el resto de la
  app) usen exactamente el mismo.

---

<a name="parte-6"></a>

## Parte 6 — La credencial: `frontend/src/infrastructure/authStorage.js`

De este archivo, en el flujo que seguimos, **solo importa `getToken`** (lo usan apiClient
L7 y App L20). El resto son funciones para el reloj de sesión y los permisos de admin.

```jsx
 1  const KEY = 'sentinel_token'
 2  const EXP_OVERRIDE_KEY = 'sentinel_effective_exp'
 3
 4  export const getToken = () => localStorage.getItem(KEY)
 5  export const setToken = (token) => {
 6    localStorage.setItem(KEY, token)
 7    localStorage.removeItem(EXP_OVERRIDE_KEY)
 8  }
 9  export const removeToken = () => {
10    localStorage.removeItem(KEY)
11    localStorage.removeItem(EXP_OVERRIDE_KEY)
12  }
```

- **L1** — `KEY` es el nombre del "cajón" del navegador donde vive el token de sesión:
  `'sentinel_token'`.
- **L2** — otro nombre de cajón, para una fecha de expiración alternativa (lo usa el
  temporizador de sesión, no este flujo).
- **L4** — **`getToken`**: lee ese cajón del navegador y devuelve el token (un texto largo)
  o `null` si no hay.
  - `localStorage` = un almacén chico que el navegador guarda **incluso después de cerrar
    la pestaña**. Es por eso que seguís logueado si volvés más tarde.
  - **→ lo llaman apiClient.js L7 (para firmar cada pedido) y App.jsx L20 (para decidir si
    te deja entrar a una pantalla protegida).**
- **L5-8** — `setToken`: guarda un token nuevo (lo usa el login) y borra la expiración
  alternativa.
- **L9-12** — `removeToken`: borra todo (lo usa el logout).

El resto del archivo (`getPayload`, `getExpiration`, `isAdmin`, `isSuperUser`, ...) abre el
token para leer qué dice por dentro (cuándo vence, si sos admin). No participa del recorrido
de las analíticas.

---

<a name="parte-7"></a>

## Parte 7 — Los componentes que dibujan el resultado

Cuando llega el render 2, la pantalla le pasa `analyticsStats`, `incident` y `trend` a
estos tres componentes. Los tres comparten un patrón: **si el dato viene vacío, no dibujan
nada.**

### 7.1 `frontend/src/presentation/components/ReliabilityBadge.jsx` — la medalla

```jsx
 1  import { cn } from '../../infrastructure/utils'
 2
 3  const TIER_STYLES = {
 4    Platinum: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
 5    Gold: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
 6    Silver: 'bg-slate-400/10 text-slate-300 border-slate-400/20',
 7    Bronze: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
 8    Unranked: 'bg-gray-500/10 text-text-secondary border-border-subtle',
 9  }
10
11  export function ReliabilityBadge({ tier }) {
12    if (!tier) return null
13
14    return (
15      <span className={cn(
16        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border',
17        TIER_STYLES[tier] || TIER_STYLES.Unranked
18      )}>
19        {tier}
20      </span>
21    )
22  }
```

- **L1** — trae `cn` (unir estilos).
- **L3-9** — `TIER_STYLES`: una tabla de "nombre de medalla → colores". Cinco entradas.
- **L11** — el componente. Recibe **un solo dato de entrada**: `tier` (un texto como
  `"Gold"`, o nada). La pantalla se lo pasa en su L261:
  `tier={analyticsStats?.reliability_tier}`.
- **L12** — **`if (!tier) return null`: si no hay medalla, no dibuja nada.** Esta línea es
  la razón por la que en el render 1 (cuando `analyticsStats` todavía es `null`) la medalla
  simplemente no aparece, sin error y sin hueco.
- **L14-21** — si hay medalla:
  - **L15-18** — arma la píldora: estilos base (L16) + los colores que correspondan al
    nombre (L17); si el nombre no está en la tabla, usa los de `Unranked`.
  - **L19** — escribe el texto de la medalla (`{tier}`).

### 7.2 `frontend/src/presentation/components/IncidentBanner.jsx` — el aviso rojo

```jsx
 1  import { AlertTriangle } from 'lucide-react'
 2  import { useTranslation } from 'react-i18next'
 3
 4  function formatElapsed(startedAt, t) {
 5    const diffMs = Date.now() - new Date(startedAt).getTime()
 6    const minutes = Math.max(1, Math.round(diffMs / 60000))
 7    if (minutes < 60) return t('serviceDetail.minutesAgo', { count: minutes })
 8    const hours = Math.round(minutes / 60)
 9    return t('serviceDetail.hoursAgo', { count: hours })
10  }
11
12  export function IncidentBanner({ incident }) {
13    const { t } = useTranslation()
14    if (!incident?.active_incident) return null
15
16    return (
17      <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4">
18        <AlertTriangle className="text-red-400 shrink-0" size={20} />
19        <div>
20          <p className="text-red-400 font-black text-sm">{t('serviceDetail.incidentActive')}</p>
21          <p className="text-text-secondary text-xs mt-0.5">
22            {t('serviceDetail.incidentSince', { time: formatElapsed(incident.started_at, t) })}
23          </p>
24        </div>
25      </div>
26    )
27  }
```

- **L1** — el ícono de triángulo de alerta.
- **L2** — `useTranslation`: el sistema de idiomas; entrega la función `t()` que busca el
  texto traducido a partir de una clave.
- **L4-10** — `formatElapsed`: convierte una hora de inicio en un texto tipo "hace 5
  minutos" / "hace 2 horas".
  - **L5** — diferencia entre ahora y la hora de inicio, en milisegundos.
  - **L6** — pasada a minutos, mínimo 1.
  - **L7** — si es menos de una hora, devuelve el texto en minutos.
  - **L8-9** — si no, pasa a horas y devuelve el texto en horas.
- **L12** — el componente. Recibe `incident` (el objeto del ayudante de analíticas, o
  `null`). La pantalla se lo pasa en su L301.
- **L14** — **`if (!incident?.active_incident) return null`: si no hay incidente, o si
  `active_incident` es falso, no dibuja nada.** Por eso el aviso rojo aparece **solo**
  cuando el servicio está caído en este momento, y desaparece apenas se recupera.
- **L16-25** — si hay incidente activo: una caja roja con el ícono (L18), el título
  traducido "incidente activo" (L20) y la línea "caído desde hace X" (L22), donde la X sale
  de `formatElapsed` aplicado a `incident.started_at`.

### 7.3 `frontend/src/presentation/components/TrendIndicator.jsx` — el recuadro de tendencia

```jsx
 1  import { TrendingUp, Minus } from 'lucide-react'
 2  import { useTranslation } from 'react-i18next'
 3
 4  export function TrendIndicator({ trend }) {
 5    const { t } = useTranslation()
 6    if (!trend?.has_data) return null
 7
 8    const Icon = trend.is_degrading ? TrendingUp : Minus
 9    const colorClass = trend.is_degrading ? 'text-orange-400' : 'text-emerald-400'
10
11    return (
12      <div className="bg-bg-card border border-border-subtle p-5 rounded-3xl">
13        <p className="text-text-secondary text-[10px] uppercase font-black tracking-widest mb-2">
14          {t('serviceDetail.latencyTrend')}
15        </p>
16        <div className={`flex items-center gap-2 font-black text-2xl tracking-tighter ${colorClass}`}>
17          <Icon size={20} />
18          {trend.slope_ms_per_check.toFixed(1)} ms/chk
19        </div>
20        {trend.is_degrading && trend.predicted_checks_to_breach != null && (
21          <p className="text-[10px] text-orange-400/80 mt-2 font-medium">
22            {t('serviceDetail.breachIn', { count: trend.predicted_checks_to_breach })}
23          </p>
24        )}
25      </div>
26    )
27  }
```

- **L1** — dos íconos: flecha hacia arriba (`TrendingUp`) y una raya plana (`Minus`).
- **L2** — el sistema de idiomas.
- **L4** — el componente. Recibe `trend` (el objeto del ayudante, o `null`). La pantalla se
  lo pasa en su L317.
- **L6** — **`if (!trend?.has_data) return null`: si no hay datos de tendencia, no dibuja
  nada.** El servidor manda `has_data: false` cuando hay menos de 2 revisiones para
  calcular.
- **L8** — elige el ícono: flecha hacia arriba si `is_degrading` (está empeorando), raya
  plana si no.
- **L9** — elige el color: naranja si empeora, verde si está estable.
- **L11-25** — el recuadro:
  - **L13-15** — el título traducido "tendencia de latencia".
  - **L16-19** — el ícono + la pendiente: `trend.slope_ms_per_check` con 1 decimal, y el
    texto "ms/chk" (milisegundos que se suman por cada revisión).
  - **L20-24** — **solo si** está empeorando **y** hay un pronóstico
    (`predicted_checks_to_breach` no es nulo): una línea "cruza el límite en N revisiones".

---

<a name="parte-8"></a>

## Parte 8 — El salto al servidor

Cuando `apiClient.get(...)` sale a la red, del otro lado lo recibe el backend. El punto de
entrada de los tres pedidos de analíticas es el mismo:

`backend/interfaces/http/views/service_views.py` → la clase `ServiceViewSet` (alrededor de
la línea 23), con un método por cada dirección:

| Pedido del frontend | Dirección real | Método en el backend |
|---------------------|----------------|----------------------|
| `useServiceAnalytics.js:15` | `GET /api/v1/services/<id>/stats/` | `stats` (≈ línea 51) |
| `useServiceAnalytics.js:16` | `GET /api/v1/services/<id>/incidents/` | `incidents` (≈ línea 70) |
| `useServiceAnalytics.js:17` | `GET /api/v1/services/<id>/trend/` | `trend` (≈ línea 85) |
| `useServiceDetail.js:13` | `GET /api/v1/services/<id>/` | (estándar del framework) |
| `useServiceDetail.js:14` | `GET /api/v1/services/<id>/history/` | `history` |
| `useServiceDetail.js:33` | `PATCH /api/v1/services/<id>/` | (estándar del framework) |
| `useServiceDetail.js:45` | `POST /api/v1/services/<id>/ping/` | `ping` |

Qué hace el servidor con cada uno de los tres de analíticas —los 4 cálculos, explicados
línea por línea— está en **`docs/COMO_FUNCIONAN_LOS_ALGORITMOS.md`**.

---

<a name="parte-9"></a>

## Parte 9 — El recorrido completo, en orden

Con todos los archivos ya vistos, este es el orden real de ejecución al abrir
`/services/42`:

1. `main.jsx:7` — React arranca y dibuja `App`.
2. `App.jsx:34` — el router compara la dirección con su lista.
3. `App.jsx:42` — coincide `"/services/:id"`; guarda `id = "42"`.
4. `App.jsx:20` — `ProtectedRoute` confirma que `getToken()` devuelve algo
   (`authStorage.js:4`). Hay sesión → dibuja `ServiceDetailPage`.

**Render 1 de la pantalla:**

5. `ServiceDetailPage.jsx:201` — lee `id = "42"` de la dirección.
6. `ServiceDetailPage.jsx:203` — llama a `useServiceDetail("42")`.
   - `useServiceDetail.js:5-7` — crea los cajones: `service = null`, `history = []`,
     `loading = true`.
   - `useServiceDetail.js:67` — devuelve esos cajones (todavía vacíos) + `ping` +
     `toggleStatus`.
7. `ServiceDetailPage.jsx:204` — llama a `useServiceAnalytics("42")`.
   - `useServiceAnalytics.js:5-8` — crea los cajones: `stats/incident/trend = null`,
     `loading = true`.
   - `useServiceAnalytics.js:31` — devuelve esos cajones (vacíos).
8. `ServiceDetailPage.jsx:240` — `loading` (el de `useServiceDetail`) es `true` →
   **dibuja `ServiceDetailSkeleton` y corta.** En pantalla: el esqueleto gris.

**Después del render 1, React ejecuta los `useEffect`:**

9. `useServiceDetail.js:24-27` — `id` es válido → llama a `fetch()`.
   - `useServiceDetail.js:12-14` — dispara `GET /services/42/` y `GET /services/42/history/`
     a la vez.
10. `useServiceAnalytics.js:27-28` — llama a `fetch()`.
    - `useServiceAnalytics.js:14-17` — dispara `GET /services/42/stats/`,
      `/incidents/` y `/trend/` a la vez.
11. `apiClient.js:6-9` — cada uno de esos 5 pedidos pasa por el checkpoint: se le pega
    `/api/v1` adelante y se le adjunta `Authorization: Bearer <token>`.
12. Los 5 pedidos salen a la red. El servidor responde (Parte 8).

**Vuelven las respuestas:**

13. `useServiceDetail.js:16-17` — `setService(...)` y `setHistory(...)` llenan sus cajones.
14. `useServiceDetail.js:20` — `setLoading(false)`.
15. `useServiceAnalytics.js:19-21` — `setStats/setIncident/setTrend` llenan sus cajones.
16. `useServiceAnalytics.js:23` — `setLoading(false)`.

Cada uno de esos `set...` pide un nuevo render. React los junta.

**Render 2 de la pantalla:**

17. `ServiceDetailPage.jsx:203-204` — las mismas dos líneas se ejecutan otra vez, pero
    ahora los ayudantes devuelven los cajones **llenos**.
18. `ServiceDetailPage.jsx:240` — `loading` ya es `false` → **no** dibuja el esqueleto;
    sigue.
19. `ServiceDetailPage.jsx:210-216` — `useMemo` recalcula el `stats` local (uptime y
    outages del navegador) porque `history` cambió.
20. `ServiceDetailPage.jsx:261` — `<ReliabilityBadge tier={analyticsStats.reliability_tier} />`
    → `ReliabilityBadge.jsx:12` ya recibe un valor → dibuja la medalla.
21. `ServiceDetailPage.jsx:301` — `<IncidentBanner incident={incident} />` →
    `IncidentBanner.jsx:14` → dibuja el aviso rojo **solo si** `active_incident` es
    verdadero.
22. `ServiceDetailPage.jsx:317` — `<TrendIndicator trend={trend} />` →
    `TrendIndicator.jsx:6` → dibuja el recuadro **solo si** `has_data` es verdadero.
23. `ServiceDetailPage.jsx:327, 337, 345` — el gráfico, la línea de tiempo y la tabla
    reciben `history` y se dibujan con datos.

En pantalla: el detalle completo, con la medalla, (si corresponde) el aviso, y el recuadro
de tendencia.

**Si después navegás a `/services/43`:**

24. `ServiceDetailPage.jsx:201` — ahora `id = "43"`.
25. `useServiceAnalytics.js:25` y `useServiceDetail.js:22` — como `id` cambió, `useCallback`
    fabrica un `fetch` nuevo.
26. `useServiceAnalytics.js:27-29` y `useServiceDetail.js:24-28` — como `fetch` cambió, el
    `useEffect` se vuelve a ejecutar → todo el ciclo se repite con el servicio 43. Sin
    apretar nada.

---

<a name="apendice"></a>

## Apéndice — Glosario de términos

**React** — la librería con la que está hecho el frontend. Su idea central: describís cómo
se ve la pantalla para un conjunto de datos, y cuando los datos cambian, React vuelve a
ejecutar tu código y actualiza lo que haga falta.

**Componente** — una función que devuelve la descripción de un pedazo de pantalla. La
pantalla entera y cada recuadrito son componentes.

**Render / dibujado** — una ejecución completa de la función de un componente. Ocurre al
aparecer y cada vez que cambia un dato guardado.

**Estado / cajón** — un espacio de memoria que sobrevive entre renders. Se crea con
`useState`, que devuelve `[contenido, funciónParaCambiarlo]`. Cambiarlo dispara un render.

**Prop / dato de entrada** — un valor que un componente le pasa a otro. En
`<ReliabilityBadge tier={...} />`, `tier` es una prop.

**Hook** — una función de React (o hecha con las de React) cuyo nombre empieza con `use`.
`useState`, `useEffect`, `useCallback`, `useMemo` son de React; `useServiceDetail` y
`useServiceAnalytics` son "ayudantes" hechos en este proyecto con las anteriores.

**`useState(inicial)`** — crea un cajón con un valor inicial.

**`useEffect(fn, [deps])`** — ejecuta `fn` **después** del render. Lo repite cuando cambia
alguno de los valores de la lista `deps`. Con `[]` corre una sola vez.

**`useCallback(fn, [deps])`** — devuelve la misma `fn` en cada render, y solo fabrica una
nueva cuando cambia algún valor de `deps`. Sirve para que un `useEffect` que depende de esa
función no se dispare de más.

**`useMemo(fn, [deps])`** — igual que `useCallback` pero para el **resultado** de un
cálculo, no para la función.

**`memo(Componente)`** — envuelve un componente para que no se vuelva a dibujar si sus props
no cambiaron.

**Desarmar (destructuring)** — `const { a, b } = objeto` toma los campos `a` y `b` del
objeto y los deja como variables sueltas. `const [x, y] = lista` hace lo mismo por
posición. `const { stats: analyticsStats } = ...` toma el campo `stats` y lo renombra a
`analyticsStats`.

**`async` / `await`** — `async` marca una función que contiene esperas. `await` frena la
función hasta que una tarea lenta (un pedido al servidor, una pausa) termina, sin congelar
el resto de la página.

**Promise / promesa** — un "vale" que representa un resultado que todavía no está. `await`
espera a que el vale se canjee.

**`Promise.all([A, B, C])`** — arranca A, B y C a la vez y entrega un único vale que se
canjea cuando **las tres** terminaron. Tarda lo que la más lenta, no la suma.

**`?.` (encadenamiento opcional)** — `a?.b` da `undefined` en vez de romper si `a` es
`null` o `undefined`.

**`|| valor`** — "si lo de la izquierda es vacío/falso, usá esto otro". `stats?.uptime || '100'`
= el uptime, o `'100'` si no hay.

**Texto con hueco (template literal)** — el texto entre comillas invertidas con `${...}`
adentro. `` `/services/${id}/stats/` `` con `id = "42"` produce `/services/42/stats/`.

**axios** — la librería que hace los pedidos HTTP. Pone la respuesta del servidor en el
campo `.data`.

**interceptor** — un checkpoint que axios ejecuta en cada pedido que sale (`request`) o en
cada respuesta que vuelve (`response`).

**`localStorage`** — almacén chico del navegador que persiste aunque cierres la pestaña.
Ahí vive el token de sesión.

**endpoint / dirección** — una ruta del servidor que responde a un pedido, por ejemplo
`GET /api/v1/services/42/stats/`.

**JSON** — el formato de texto en el que viajan los datos entre servidor y navegador:
listas y pares "nombre: valor".

**token (JWT)** — el texto largo que prueba que iniciaste sesión. El navegador lo guarda y
el cartero lo adjunta a cada pedido.

**401** — el código con el que el servidor dice "no te reconozco". El cartero, al verlo,
borra el token y te manda a `/login`.

**`PATCH` / `POST` / `GET`** — tipos de pedido HTTP. `GET` = traer algo; `POST` = ejecutar
una acción; `PATCH` = modificar parte de un registro.
