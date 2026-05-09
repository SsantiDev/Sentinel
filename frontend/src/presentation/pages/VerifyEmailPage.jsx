import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { GalaxyBackground } from '../components/GalaxyBackground'
import logo from '../../assets/logo.png'
import { useTranslation } from 'react-i18next'
import apiClient from '../../infrastructure/apiClient'
import { setToken } from '../../infrastructure/authStorage'

const OTP_LENGTH = 6
const OTP_TTL = 15 * 60

export function VerifyEmailPage() {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL)
  const [resending, setResending] = useState(false)
  const inputs = useRef([])
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const email = params.get('email') || ''
  const { t } = useTranslation()

  useEffect(() => {
    if (!email) navigate('/register')
  }, [email])

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const handleDigit = (i, val) => {
    const v = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = v
    setDigits(next)
    if (v && i < OTP_LENGTH - 1) inputs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus()
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (pasted.length === OTP_LENGTH) {
      setDigits(pasted.split(''))
      inputs.current[OTP_LENGTH - 1]?.focus()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const code = digits.join('')
    if (code.length < OTP_LENGTH) { setError(t('verify.incomplete')); return }
    setLoading(true)
    setError(null)
    try {
      const { data } = await apiClient.post('/auth/verify-email/', { email, code })
      setToken(data.access)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || t('verify.error'))
      setDigits(Array(OTP_LENGTH).fill(''))
      inputs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await apiClient.post('/auth/resend-verification/', { email })
    } catch { /* silent */ }
    setSecondsLeft(OTP_TTL)
    setResending(false)
    setError(null)
  }

  return (
    <div className="login-container min-h-screen px-4 py-8">
      <GalaxyBackground />
      <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 mb-3">
            <img src={logo} alt="Sentinel" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-text-primary text-2xl font-black tracking-tight">{t('verify.title')}</h1>
          <p className="text-text-secondary mt-1 text-sm text-center">
            {t('verify.subtitle')} <span className="text-[#2ecc71] font-semibold">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputs.current[i] = el)}
                className="w-11 h-14 text-center text-xl font-black bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-text-primary focus:outline-none focus:border-[#2ecc71] focus:ring-1 focus:ring-[#2ecc71] transition-all"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                inputMode="numeric"
                autoFocus={i === 0}
              />
            ))}
          </div>

          <div className="text-center">
            <span className={`text-xs font-mono ${secondsLeft < 60 ? 'text-red-400' : 'text-text-secondary'}`}>
              {secondsLeft > 0 ? `${t('verify.expires')} ${fmt(secondsLeft)}` : t('verify.expired')}
            </span>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm py-2 px-3 rounded-xl flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || secondsLeft === 0} className="w-full bg-[#2ecc71] text-[#0f0f1a] font-black py-3 rounded-xl hover:bg-[#27ae60] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_15px_rgba(46,204,113,0.3)] disabled:opacity-50 disabled:hover:scale-100 text-sm">
            {loading ? t('verify.verifying') : t('verify.verify')}
          </button>
        </form>

        <div className="text-center mt-4 space-y-2">
          <button onClick={handleResend} disabled={resending || secondsLeft > 0} className="text-xs text-text-secondary hover:text-[#2ecc71] disabled:opacity-40 transition-colors">
            {resending ? t('verify.resending') : t('verify.resend')}
          </button>
          <br />
          <Link to="/register" className="text-xs text-text-secondary hover:text-[#2ecc71] transition-colors">{t('verify.back')}</Link>
        </div>
      </div>
    </div>
  )
}
