import { useState } from 'react'
import apiClient from '../../infrastructure/apiClient'
import { getToken, setToken, removeToken } from '../../infrastructure/authStorage'

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken())

  async function login(username, password) {
    const { data } = await apiClient.post('/auth/token/', { username, password })
    setToken(data.access)
    setIsAuthenticated(true)
  }

  function logout() {
    removeToken()
    setIsAuthenticated(false)
  }

  return { login, logout, isAuthenticated }
}
