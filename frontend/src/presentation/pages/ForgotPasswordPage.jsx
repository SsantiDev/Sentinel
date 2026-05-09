import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GalaxyBackground } from '../components/GalaxyBackground'
import logo from '../../assets/logo.png'
import { useTranslation } from 'react-i18next'
import apiClient from '../../infrastructure/apiClient'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await apiClient.post('/auth/forgot-password/', { email })
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="login-container min-h-screen px-4 py-8">
        <GalaxyBackground />
        <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#2ecc71]/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#2ecc71]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-text-primary text-xl font-black mb-2">{t('forgot.sentTitle')}</h2>
          <p className="text-text-secondary text-sm mb-6">{t('forgot.sentDesc')} <span className="text-[#2ecc71]">{email}</span></p>
          <button
            onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}`)}
            className="w-full bg-[#2ecc71] text-[#0f0f1a] font-black py-3 rounded-xl hover:bg-[#27ae60] transition-all text-sm"
          >
            {t('forgot.enterCode')}
          </button>
          <Link to="/login" className="block mt-4 text-xs text-text-secondary hover:text-[#2ecc71] transition-colors">{t('forgot.backToLogin')}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="login-container min-h-screen px-4 py-8">
      <GalaxyBackground />
      <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 mb-3">
            <img src={logo} alt="Sentinel" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-text-primary text-2xl font-black tracking-tight">{t('forgot.title')}</h1>
          <p className="text-text-secondary mt-1 text-sm text-center">{t('forgot.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">{t('forgot.email')}</label>
            <input
              className="w-full bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#2ecc71] focus:ring-1 focus:ring-[#2ecc71] transition-all text-sm"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-[#2ecc71] text-[#0f0f1a] font-black py-3 rounded-xl hover:bg-[#27ae60] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_15px_rgba(46,204,113,0.3)] disabled:opacity-50 disabled:hover:scale-100 text-sm">
            {loading ? t('forgot.sending') : t('forgot.send')}
          </button>
        </form>

        <p className="text-center text-text-secondary text-xs mt-6">
          <Link to="/login" className="text-[#2ecc71] hover:underline font-semibold">{t('forgot.backToLogin')}</Link>
        </p>
      </div>
    </div>
  )
}
