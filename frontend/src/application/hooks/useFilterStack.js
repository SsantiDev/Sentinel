import { useCallback, useRef, useState } from 'react'

// Tope de niveles de "deshacer" que se recuerdan. Evita que la pila crezca
// sin limite si alguien cambia filtros durante mucho rato.
const MAX_DEPTH = 20

/**
 * Pila LIFO de estados de filtro anteriores.
 * push: apila el estado actual antes de cambiarlo. push O(1).
 * pop: saca el ultimo apilado para volver a el. pop O(1).
 * El ultimo que entra es el primero que sale, igual que el boton deshacer.
 */
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
