import { useState, useEffect, useCallback } from 'react'
import apiClient from '../../infrastructure/apiClient'

const POLL_INTERVAL_MS = 30000 // cada cuanto vuelve a preguntar al backend (30s)

export function useSchedulerStatus() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/scheduler/status/')
      setStatus(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetch])

  return { status, loading, error }
}
