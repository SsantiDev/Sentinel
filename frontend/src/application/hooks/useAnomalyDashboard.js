import { useState, useEffect, useCallback } from 'react'
import apiClient from '../../infrastructure/apiClient'

export function useAnomalyDashboard() {
  const [stats, setStats] = useState(null)
  const [trends, setTrends] = useState(null)
  const [anomalies, setAnomalies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, trendsRes, anomaliesRes] = await Promise.all([
        apiClient.get('/transaction-anomalies/stats/'),
        apiClient.get('/transaction-anomalies/trends/'),
        apiClient.get('/transaction-anomalies/'),
      ])
      setStats(statsRes.data)
      setTrends(trendsRes.data)
      setAnomalies(anomaliesRes.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  const updateStatus = useCallback(async (id, status) => {
    const { data } = await apiClient.patch(`/transaction-anomalies/${id}/`, { status })
    setAnomalies((prev) => prev.map((a) => (a.id === id ? data : a)))
    return data
  }, [])

  const fetchTimeline = useCallback(async (id) => {
    const { data } = await apiClient.get(`/transaction-anomalies/${id}/timeline/`)
    return data
  }, [])

  // Borra TODAS las transacciones y anomalias (solo admin) y recarga el tablero.
  const resetData = useCallback(async () => {
    const { data } = await apiClient.post('/transactions/reset/')
    await fetch()
    return data
  }, [fetch])

  return { stats, trends, anomalies, loading, error, refetch: fetch, updateStatus, fetchTimeline, resetData }
}
