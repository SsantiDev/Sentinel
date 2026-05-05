import { useState, useEffect, useCallback } from 'react'
import apiClient from '../../infrastructure/apiClient'

export function useHistory() {
  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    service: '',
    status: '',
    min_latency: '',
    max_latency: '',
    status_code: '',
    start_date: '',
    end_date: '',
    ordering: '-checked_at'
  })

  const [firstLoad, setFirstLoad] = useState(true)

  const fetch = useCallback(async () => {
    if (firstLoad) setLoading(true)
    try {
      const params = { ...filters }
      // Clean empty params
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key]
      })

      const res = await apiClient.get('/checks/', { params })
      setChecks(res.data)
    } finally {
      setLoading(false)
      setFirstLoad(false)
    }
  }, [filters])

  useEffect(() => { fetch() }, [fetch])

  return { checks, loading, filters, setFilters }
}
