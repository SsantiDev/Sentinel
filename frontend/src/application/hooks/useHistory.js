import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import apiClient from '../../infrastructure/apiClient'

const DEFAULT_FILTERS = {
  service: '',
  status: '',
  min_latency: '',
  max_latency: '',
  status_code: '',
  start_date: '',
  end_date: '',
  ordering: '-checked_at',
}

function paramsToFilters(params) {
  return {
    service: params.get('service') || '',
    status: params.get('status') || '',
    min_latency: params.get('min_latency') || '',
    max_latency: params.get('max_latency') || '',
    status_code: params.get('status_code') || '',
    start_date: params.get('start_date') || '',
    end_date: params.get('end_date') || '',
    ordering: params.get('ordering') || '-checked_at',
  }
}

export function useHistory() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const page = Number(searchParams.get('page') || '1')
  const pageSize = Number(searchParams.get('page_size') || '10')
  const filters = paramsToFilters(searchParams)

  const [firstLoad, setFirstLoad] = useState(true)

  const setPage = useCallback((updater) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      const nextPage = typeof updater === 'function' ? updater(Number(prev.get('page') || '1')) : updater
      next.set('page', String(nextPage))
      return next
    }, { replace: true })
  }, [setSearchParams])

  const setPageSize = useCallback((size) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('page_size', String(size))
      next.set('page', '1')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const setFilters = useCallback((updater) => {
    setSearchParams(prev => {
      const current = paramsToFilters(prev)
      const next = typeof updater === 'function' ? updater(current) : updater
      const params = new URLSearchParams()
      Object.entries(next).forEach(([k, v]) => { if (v) params.set(k, v) })
      params.set('page', '1')
      const size = prev.get('page_size')
      if (size) params.set('page_size', size)
      return params
    }, { replace: true })
  }, [setSearchParams])

  const fetch = useCallback(async () => {
    if (firstLoad) setLoading(true)
    try {
      const params = { ...filters, page, page_size: pageSize }
      Object.keys(params).forEach(key => { if (!params[key]) delete params[key] })
      const res = await apiClient.get('/checks/', { params })
      setChecks(res.data.results)
      setTotal(res.data.count)
    } finally {
      setLoading(false)
      setFirstLoad(false)
    }
  }, [filters, page, pageSize])

  useEffect(() => { fetch() }, [fetch])

  return {
    checks, loading, total, page, pageSize,
    setPage, setPageSize,
    filters, setFilters,
  }
}
