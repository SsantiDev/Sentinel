import { useState, useEffect, useCallback } from 'react'
import apiClient from '../../infrastructure/apiClient'

export function useServiceDetail(id) {
  const [service, setService] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [svc, hist] = await Promise.all([
        apiClient.get(`/services/${id}/`),
        apiClient.get(`/services/${id}/history/`),
      ])
      setService(svc.data)
      setHistory(hist.data)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [id])

  useEffect(() => { 
    if (id && id !== 'undefined') {
      fetch() 
    }
  }, [fetch, id])

  const toggleStatus = async () => {
    if (!service) return
    try {
      await apiClient.patch(`/services/${id}/`, {
        is_active: !service.is_active
      })
      await fetch(true)
    } catch (e) {
      console.error('Error toggling status:', e)
    }
  }

  const ping = async () => {
    await apiClient.post(`/services/${id}/ping/`)
    await fetch(true)
  }

  return { service, history, loading, ping, toggleStatus }
}
