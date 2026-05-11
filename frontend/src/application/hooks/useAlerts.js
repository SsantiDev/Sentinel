import { useState, useEffect, useCallback } from 'react'
import apiClient from '../../infrastructure/apiClient'

export function useAlerts() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRules = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await apiClient.get('/alert-rules/')
      setRules(res.data)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const createRule = async (data) => {
    await apiClient.post('/alert-rules/', data)
    await fetchRules()
  }

  const updateRule = async (id, data) => {
    await apiClient.put(`/alert-rules/${id}/`, data)
    await fetchRules()
  }

  const deleteRule = async (id) => {
    await apiClient.delete(`/alert-rules/${id}/`)
    await fetchRules()
  }

  const toggleRule = async (rule) => {
    const nextActive = !rule.is_active
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: nextActive } : r))
    try {
      const { data } = await apiClient.patch(`/alert-rules/${rule.id}/`, { is_active: nextActive })
      if (data?.is_active !== undefined) {
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: data.is_active } : r))
      }
    } catch (e) {
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: rule.is_active } : r))
      console.error('Error toggling alert rule:', e)
    }
  }

  return { rules, loading, createRule, updateRule, deleteRule, toggleRule }
}
