import { useState, useEffect } from 'react'
import apiClient from '../../infrastructure/apiClient'

export function useSettings() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const { data } = await apiClient.get('/settings/global/')
      setConfig(data)
    } catch (err) {
      setError('Error al cargar la configuración')
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = async (section, newData) => {
    try {
      const { data } = await apiClient.patch('/settings/global/', {
        section,
        data: newData
      })
      setConfig(data)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Error al actualizar' }
    }
  }

  const updateProfile = async (profileData) => {
    try {
      await apiClient.post('/settings/profile/password/', profileData)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Error al actualizar perfil' }
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  return { config, loading, error, updateConfig, updateProfile, refresh: fetchConfig }
}
