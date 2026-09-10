import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import apiClient from '../../infrastructure/apiClient'
import { useFilterStack } from './useFilterStack'

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

function buildFilterParams(filterObj, pageSizeValue) {
  const params = new URLSearchParams()
  Object.entries(filterObj).forEach(([k, v]) => { if (v) params.set(k, v) })
  params.set('page', '1')
  if (pageSizeValue) params.set('page_size', String(pageSizeValue))
  return params
}

export function useHistory() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filterStack = useFilterStack()

  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const page = Number(searchParams.get('page') || '1')
  const pageSize = Number(searchParams.get('page_size') || '10')
  const searchKey = searchParams.toString()
  const filters = useMemo(
    () => paramsToFilters(new URLSearchParams(searchKey)),
    [searchKey]
  )

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
    filterStack.push(filters)
    setSearchParams(prev => {
      const current = paramsToFilters(prev)
      const next = typeof updater === 'function' ? updater(current) : updater
      return buildFilterParams(next, prev.get('page_size'))
    }, { replace: true })
  }, [filters, filterStack, setSearchParams])

  const undoFilter = useCallback(() => {
    const previous = filterStack.pop()
    if (!previous) return
    setSearchParams(prev => buildFilterParams(previous, prev.get('page_size')), { replace: true })
  }, [filterStack, setSearchParams])

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
  }, [filters, page, pageSize, firstLoad])

  useEffect(() => { fetch() }, [fetch])

  return {
    checks, loading, total, page, pageSize,
    setPage, setPageSize,
    filters, setFilters,
    undoFilter, canUndo: filterStack.canUndo,
  }
}
