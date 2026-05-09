const KEY = 'sentinel_token'
const EXP_OVERRIDE_KEY = 'sentinel_effective_exp'

export const getToken = () => localStorage.getItem(KEY)
export const setToken = (token) => {
  localStorage.setItem(KEY, token)
  localStorage.removeItem(EXP_OVERRIDE_KEY)
}
export const removeToken = () => {
  localStorage.removeItem(KEY)
  localStorage.removeItem(EXP_OVERRIDE_KEY)
}

export const setEffectiveExpiration = (ms) => localStorage.setItem(EXP_OVERRIDE_KEY, String(ms))

export const getEffectiveExpiration = () => {
  const override = localStorage.getItem(EXP_OVERRIDE_KEY)
  if (override) return parseInt(override, 10)
  return getExpiration()
}

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

export const isSuperUser = () => {
  const payload = getPayload()
  return !!payload?.is_superuser
}
