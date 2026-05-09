import { useState, useEffect } from 'react'
import apiClient from '../../infrastructure/apiClient'
import { isAdmin, setToken } from '../../infrastructure/authStorage'

export function useSettings() {
  const [config, setConfig] = useState({
    notifications: { global_email: '', alert_on_failure: false },
    system: { default_check_interval: 60, log_retention_days: 30, maintenance_mode: false },
    security: { session_timeout_minutes: 480, max_login_attempts: 5 }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchConfig = async () => {
    if (!isAdmin()) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data } = await apiClient.get('/settings/global/')
      setConfig(data)
    } catch (err) {
      setError('Error al cargar la configuración global')
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
      const { data } = await apiClient.post('/settings/profile/password/', profileData)
      if (profileData.session_timeout_minutes !== undefined) {
        if (data.access) {
          setToken(data.access)
        }
        setConfig(prev => ({
          ...prev,
          security: { ...prev.security, session_timeout_minutes: profileData.session_timeout_minutes }
        }))
      }
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
