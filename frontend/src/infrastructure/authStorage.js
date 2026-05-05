const KEY = 'sentinel_token'

export const getToken = () => localStorage.getItem(KEY)
export const setToken = (token) => localStorage.setItem(KEY, token)
export const removeToken = () => localStorage.removeItem(KEY)

export const getPayload = () => {
  const token = getToken()
  if (!token) return null
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch (e) {
    return null
  }
}

export const getExpiration = () => {
  const payload = getPayload()
  return payload?.exp ? payload.exp * 1000 : null
}

export const isAdmin = () => {
  const payload = getPayload()
  return !!payload?.is_staff
}
