import { useState, useEffect, useCallback } from 'react'
import apiClient from '../../infrastructure/apiClient'

const REFRESH_MS = 5000

// Trae las ultimas lineas del registro del servidor. Opcionalmente filtra por
// nivel y se refresca solo cada pocos segundos (auto) para verlo "en vivo".
export function useLogs({ lines = 200 } = {}) {
  const [entries, setEntries] = useState([])
  const [level, setLevel] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [auto, setAuto] = useState(true)

  const fetchLogs = useCallback(async () => {
    try {
      const params = { lines }
      if (level) params.level = level
      const { data } = await apiClient.get('/logs/tail/', { params })
      setEntries(data.lines || [])
      setError(null)
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }, [lines, level])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (!auto) return undefined
    const id = setInterval(fetchLogs, REFRESH_MS)
    return () => clearInterval(id)
  }, [auto, fetchLogs])

  return { entries, level, setLevel, loading, error, auto, setAuto, refresh: fetchLogs }
}
