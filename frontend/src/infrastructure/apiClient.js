import axios from 'axios'
import { getToken } from './authStorage'

const apiClient = axios.create({ baseURL: '/api/v1' })

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sentinel_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
