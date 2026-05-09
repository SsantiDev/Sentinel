import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GalaxyBackground } from '../components/GalaxyBackground'
import logo from '../../assets/logo.png'
import { useTranslation } from 'react-i18next'
import apiClient from '../../infrastructure/apiClient'

export function RegisterPage() {
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { t } = useTranslation()

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError(t('register.passwordMismatch'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      await apiClient.post('/auth/register/', {
        email: form.email,
        username: form.username,
        password: form.password,
      })
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}`)
    } catch (err) {
      setError(err.response?.data?.error || t('register.error'))
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#2ecc71] focus:ring-1 focus:ring-[#2ecc71] transition-all text-sm'

  return (
    <div className="login-container min-h-screen px-4 py-8">
      <GalaxyBackground />
      <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-md transition-all duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 mb-3">
            <img src={logo} alt="Sentinel" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-text-primary text-2xl font-black tracking-tight">SENTINEL</h1>
          <p className="text-text-secondary mt-1 text-sm">{t('register.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">{t('register.email')}</label>
            <input className={inputCls} type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} autoFocus required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">{t('register.username')}</label>
            <input className={inputCls} placeholder={t('register.usernamePlaceholder')} value={form.username} onChange={set('username')} required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">{t('register.password')}</label>
            <input className={inputCls} type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">{t('register.confirmPassword')}</label>
            <input className={inputCls} type="password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} required />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm py-2 px-3 rounded-xl flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-[#2ecc71] text-[#0f0f1a] font-black py-3 rounded-xl hover:bg-[#27ae60] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_15px_rgba(46,204,113,0.3)] disabled:opacity-50 disabled:hover:scale-100 text-sm">
            {loading ? t('register.creating') : t('register.create')}
          </button>
        </form>

        <p className="text-center text-text-secondary text-xs mt-6">
          {t('register.hasAccount')}{' '}
          <Link to="/login" className="text-[#2ecc71] hover:underline font-semibold">{t('register.loginLink')}</Link>
        </p>
      </div>
    </div>
  )
}
