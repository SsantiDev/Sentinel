import { useState, useEffect, useCallback } from 'react'
import apiClient from '../../infrastructure/apiClient'

let servicesCache = null

export function useServices() {
  const [services, setServices] = useState(servicesCache || [])
  const [loading, setLoading] = useState(!servicesCache)
  const [error, setError] = useState(null)

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const { data } = await apiClient.get('/services/')
      setServices(data)
      servicesCache = data
    } catch (e) {
      setError(e.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { 
    // If we already have cached data, fetch silently in the background
    fetch(!!servicesCache) 
  }, [fetch])

  const toggleService = useCallback(async (id, currentStatus) => {
    try {
      const { data } = await apiClient.patch(`/services/${id}/`, {
        is_active: !currentStatus
      })
      setServices(prev => {
        const updated = prev.map(s => s.id === id ? { ...s, is_active: data.is_active } : s)
        servicesCache = updated
        return updated
      })
    } catch (e) {
      console.error('Error toggling service status:', e)
    }
  }, [])

  const silentRefetch = useCallback(() => fetch(true), [fetch])

  return { services, loading, error, refetch: fetch, silentRefetch, toggleService }
}
