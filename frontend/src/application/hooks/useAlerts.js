import { useState, useEffect, useCallback } from 'react'
import apiClient from '../../infrastructure/apiClient'

export function useAlerts() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/alert-rules/')
      setRules(res.data)
    } finally {
      setLoading(false)
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
    await apiClient.patch(`/alert-rules/${rule.id}/`, { is_active: !rule.is_active })
    await fetchRules()
  }

  return { rules, loading, createRule, updateRule, deleteRule, toggleRule }
}
