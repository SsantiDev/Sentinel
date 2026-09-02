import { useState, useEffect, useCallback } from 'react'
import apiClient from '../../infrastructure/apiClient'

export function useServiceAnalytics(id) {
  const [stats, setStats] = useState(null)
  const [incident, setIncident] = useState(null)
  const [trend, setTrend] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!id || id === 'undefined') return
    setLoading(true)
    try {
      const [statsRes, incidentRes, trendRes] = await Promise.all([
        apiClient.get(`/services/${id}/stats/`),
        apiClient.get(`/services/${id}/incidents/`),
        apiClient.get(`/services/${id}/trend/`),
      ])
      setStats(statsRes.data)
      setIncident(incidentRes.data)
      setTrend(trendRes.data)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { stats, incident, trend, loading, refetch: fetch }
}
