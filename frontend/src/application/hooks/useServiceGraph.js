import { useState, useEffect, useCallback } from 'react'
import apiClient from '../../infrastructure/apiClient'

export function useServiceGraph() {
  const [nodes, setNodes] = useState([]) // array de servicios: { id, name, status, is_active, impacted }
  const [edges, setEdges] = useState([]) // array de dependencias: { id, service, depends_on }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/services/graph/')
      setNodes(data.nodes)
      setEdges(data.edges)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  const addDependency = useCallback(async (serviceId, dependsOnId) => {
    await apiClient.post('/service-dependencies/', { service: serviceId, depends_on: dependsOnId })
    await fetch()
  }, [fetch])

  const removeDependency = useCallback(async (edgeId) => {
    await apiClient.delete(`/service-dependencies/${edgeId}/`)
    await fetch()
  }, [fetch])

  return { nodes, edges, loading, error, addDependency, removeDependency, refetch: fetch }
}
