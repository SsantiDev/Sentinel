import { useState, useEffect } from 'react'
import apiClient from '../../infrastructure/apiClient'
import { isAdmin } from '../../infrastructure/authStorage'

export function useLimits() {
  const [limits, setLimits] = useState(null)
  const [loading, setLoading] = useState(!isAdmin())

  useEffect(() => {
    if (isAdmin()) return
    apiClient.get('/auth/limits/')
      .then(res => setLimits(res.data))
      .catch(() => setLimits(null))
      .finally(() => setLoading(false))
  }, [])

  return { limits, loading }
}
