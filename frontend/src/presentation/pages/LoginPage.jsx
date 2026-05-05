import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../application/hooks/useAuth'
import { useTheme } from '../../application/context/ThemeContext'
import { GalaxyBackground } from '../components/GalaxyBackground'
import logo from '../../assets/logo.png'
import { useEffect } from 'react'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reason') === 'session_expired') {
      setError('Tu sesión ha expirado por inactividad')
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(username, password)
      navigate('/dashboard')
    } catch {
      setError('Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container min-h-screen px-4 py-8">
      <GalaxyBackground />
      
      <button 
        onClick={toggleTheme}
        className="theme-toggle-login"
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDark ? (
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

      <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-md transition-all duration-500 hover:shadow-[0_0_50px_rgba(46,204,113,0.1)]">
        <div className="flex flex-col items-center mb-8 sm:mb-10">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mb-4">
            <img src={logo} alt="Sentinel Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-text-primary text-3xl sm:text-4xl font-black tracking-tight">SENTINEL</h1>
          <p className="text-text-secondary mt-1 sm:mt-2 font-medium text-sm sm:text-base">Enterprise Service Monitoring</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Username</label>
            <input
              className="w-full bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 sm:px-5 py-3 sm:py-4 text-text-primary placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#2ecc71] focus:ring-1 focus:ring-[#2ecc71] transition-all text-sm sm:text-base"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 sm:px-5 py-3 sm:py-4 text-text-primary placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#2ecc71] focus:ring-1 focus:ring-[#2ecc71] transition-all text-sm sm:text-base"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm py-2 sm:py-3 px-3 sm:px-4 rounded-xl flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2ecc71] text-[#0f0f1a] font-black py-3 sm:py-4 rounded-xl hover:bg-[#27ae60] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_15px_rgba(46,204,113,0.3)] disabled:opacity-50 disabled:hover:scale-100 text-sm sm:text-base"
          >
            {loading ? 'AUTHENTICATING...' : 'ACCESS DASHBOARD'}
          </button>
        </form>
      </div>
    </div>
  )
}
