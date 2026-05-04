import { useState, useEffect, useCallback } from 'react'
import apiClient from '../../infrastructure/apiClient'

export function useHistory() {
  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ service: '', status: '' })

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.service) params.service = filters.service
      if (filters.status) params.status = filters.status
      const res = await apiClient.get('/checks/', { params })
      setChecks(res.data)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetch() }, [fetch])

  return { checks, loading, filters, setFilters }
}
