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
      return { service: svc.data, history: hist.data }
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
    if (!id) return
    const previousCheckedAt = history?.[0]?.checked_at || null
    await apiClient.post(`/services/${id}/ping/`)

    const maxWaitMs = 15000
    const intervalMs = 1000
    let elapsed = 0

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
    const hasNewEntry = async () => {
      const result = await fetch(true)
      const latestCheckedAt = result?.history?.[0]?.checked_at || null
      return latestCheckedAt && latestCheckedAt !== previousCheckedAt
    }

    if (await hasNewEntry()) return

    while (elapsed < maxWaitMs) {
      await sleep(intervalMs)
      elapsed += intervalMs
      if (await hasNewEntry()) return
    }
  }

  return { service, history, loading, ping, toggleStatus }
}
