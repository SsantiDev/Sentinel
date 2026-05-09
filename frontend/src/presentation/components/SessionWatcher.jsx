import { useEffect } from 'react'
import { getEffectiveExpiration, removeToken } from '../../infrastructure/authStorage'

export function SessionWatcher() {
  useEffect(() => {
    const checkSession = () => {
      const expiration = getEffectiveExpiration()
      if (!expiration) return

      const now = Date.now()
      const timeLeft = expiration - now

      // Si ha expirado o está a punto de expirar (ej. < 1 seg)
      if (timeLeft <= 0) {
        removeToken()
        window.location.href = '/login?reason=session_expired'
      }
    }

    // Verificar cada 10 segundos
    const interval = setInterval(checkSession, 10000)
    
    // Verificación inmediata al montar
    checkSession()

    return () => clearInterval(interval)
  }, [])

  return null // Este componente no renderiza nada visualmente por defecto
}
