# Pilas en Sentinel

Sentinel usa una pila (stack) en un solo lugar: el botón **"Deshacer filtro"** de la pantalla de
Historial. Es una pila LIFO clásica — el último estado que se guardó es el primero que se
recupera, igual que Ctrl+Z en cualquier editor.

---

## Dónde vive

`frontend/src/application/hooks/useFilterStack.js` — la pila en sí, aislada y reutilizable, sin
nada de UI ni de lógica de filtros mezclada.

## Problema que resuelve

En Historial se puede filtrar la tabla por estado, latencia, código de error o fecha, clic a
clic sobre los títulos de columna. Cada clic pisa el filtro anterior. No había forma de volver
un paso atrás sin recordar a mano cómo estaba el filtro antes del último cambio.

## La pila

```javascript
const MAX_DEPTH = 20

export function useFilterStack() {
  const stackRef = useRef([])
  const [depth, setDepth] = useState(0)

  const push = useCallback((snapshot) => {
    const stack = stackRef.current
    stack.push(snapshot)
    if (stack.length > MAX_DEPTH) stack.shift()
    setDepth(stack.length)
  }, [])

  const pop = useCallback(() => {
    const stack = stackRef.current
    if (stack.length === 0) return null
    const value = stack.pop()
    setDepth(stack.length)
    return value
  }, [])

  const reset = useCallback(() => {
    stackRef.current = []
    setDepth(0)
  }, [])

  return { push, pop, reset, canUndo: depth > 0, depth }
}
```

Puntos clave:

- **`stackRef` en vez de `state`**: el array de la pila vive en un `useRef`, no en `useState`.
  Un array en un `ref` se puede mutar directamente (`push`/`pop`/`shift` nativos de JS) sin
  provocar un re-render en cada cambio. `depth` (solo un número) sí es estado — es lo único que
  necesita disparar un re-render, para habilitar o deshabilitar el botón.
- **`push` y `pop` son O(1)**: operar sobre el final de un array (`Array.prototype.push` /
  `pop`) no mueve el resto de los elementos, a diferencia de operar sobre el principio
  (`shift`/`unshift`, que si son O(n)).
- **`MAX_DEPTH = 20`**: tope duro. Si se supera, `shift()` saca el elemento más viejo (el del
  fondo de la pila) para no crecer sin límite. Es la única operación O(n) de todo el hook, y
  solo ocurre una vez cada 20 cambios de filtro.
- **`canUndo: depth > 0`**: se deriva del tamaño, no hay que preguntarle a la pila si está
  vacía en cada render.

## Quién empuja y quién saca

`frontend/src/application/hooks/useHistory.js:63`

```javascript
const setFilters = useCallback((updater) => {
  filterStack.push(filters)        // guarda el estado ANTES de aplicar el cambio
  setSearchParams(prev => {
    const current = paramsToFilters(prev)
    const next = typeof updater === 'function' ? updater(current) : updater
    return buildFilterParams(next, prev.get('page_size'))
  }, { replace: true })
}, [filters, filterStack, setSearchParams])
```

Cada vez que se cambia un filtro, antes de aplicar el cambio nuevo se apila el filtro tal como
estaba. Por eso el orden de "deshacer" queda correcto: al hacer pop, se recupera el estado
inmediatamente anterior al último cambio, no el actual.

`frontend/src/application/hooks/useHistory.js:72`

```javascript
const undoFilter = useCallback(() => {
  const previous = filterStack.pop()
  if (!previous) return
  setSearchParams(prev => buildFilterParams(previous, prev.get('page_size')), { replace: true })
}, [filterStack, setSearchParams])
```

`undoFilter` saca el último estado apilado y lo vuelve a poner como filtro activo. Si la pila
está vacía, `pop()` devuelve `null` y no hace nada — de ahí sale `canUndo` para deshabilitar el
botón.

Notar que los filtros en sí no viven en el estado de React: viven en la URL
(`useSearchParams`), así que un filtro aplicado sobrevive a un refresh de página. La pila de
deshacer es la única pieza que vive en memoria y se pierde al salir de la pantalla — eso es
intencional, no un descuido.

## El botón

`frontend/src/presentation/pages/HistoryPage.jsx:119`

```jsx
<button
  onClick={undoFilter}
  disabled={!canUndo}
  title={t('history.undo')}
  className="... disabled:opacity-30 disabled:cursor-not-allowed ..."
>
  <Undo2 size={14} />
  {t('history.undo')}
</button>
```

`disabled={!canUndo}` apaga el botón cuando la pila está vacía — no hace falta lógica extra en
el componente, el estado de la pila ya trae esa respuesta.

## Resumen de la relación entre piezas

```
click en columna (Estado / Latencia / Fecha)
        |
        v
  setFilters(updater)  ---push(filters actuales)--->  useFilterStack (pila)
        |
        v
  nuevo filtro va a la URL (useSearchParams)


click en "Deshacer filtro"
        |
        v
  undoFilter()  ---pop()--->  useFilterStack devuelve el filtro anterior
        |
        v
  ese filtro anterior vuelve a la URL
```

`useFilterStack` no sabe nada de filtros, URLs ni HTTP — solo apila y desapila valores
genéricos. `useHistory` es quien decide qué apilar (el objeto de filtros) y cuándo (antes de
cada cambio). Esa separación es la que permite reutilizar la pila para cualquier otro flujo de
"deshacer" que aparezca más adelante, sin tocar su código.
