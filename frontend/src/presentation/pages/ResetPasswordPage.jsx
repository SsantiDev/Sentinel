import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { GalaxyBackground } from '../components/GalaxyBackground'
import logo from '../../assets/logo.png'
import { useTranslation } from 'react-i18next'
import apiClient from '../../infrastructure/apiClient'

const OTP_LENGTH = 6

export function ResetPasswordPage() {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const inputs = useRef([])
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const email = params.get('email') || ''
  const { t } = useTranslation()

  useEffect(() => {
    if (!email) navigate('/forgot-password')
  }, [email])

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
    if (code.length < OTP_LENGTH) { setError(t('reset.incompleteCode')); return }
    if (newPassword !== confirm) { setError(t('reset.passwordMismatch')); return }
    setLoading(true)
    setError(null)
    try {
      await apiClient.post('/auth/reset-password/', { email, code, new_password: newPassword })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.error || t('reset.error'))
      setDigits(Array(OTP_LENGTH).fill(''))
      inputs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#2ecc71] focus:ring-1 focus:ring-[#2ecc71] transition-all text-sm'

  if (success) {
    return (
      <div className="login-container min-h-screen px-4 py-8">
        <GalaxyBackground />
        <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#2ecc71]/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#2ecc71]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-text-primary text-xl font-black mb-2">{t('reset.successTitle')}</h2>
          <p className="text-text-secondary text-sm mb-6">{t('reset.successDesc')}</p>
          <button onClick={() => navigate('/login')} className="w-full bg-[#2ecc71] text-[#0f0f1a] font-black py-3 rounded-xl hover:bg-[#27ae60] transition-all text-sm">
            {t('reset.goToLogin')}
          </button>
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
          <h1 className="text-text-primary text-2xl font-black tracking-tight">{t('reset.title')}</h1>
          <p className="text-text-secondary mt-1 text-sm text-center">{t('reset.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1 mb-2 block">{t('reset.code')}</label>
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
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">{t('reset.newPassword')}</label>
            <input className={inputCls} type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">{t('reset.confirmPassword')}</label>
            <input className={inputCls} type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm py-2 px-3 rounded-xl flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-[#2ecc71] text-[#0f0f1a] font-black py-3 rounded-xl hover:bg-[#27ae60] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_15px_rgba(46,204,113,0.3)] disabled:opacity-50 disabled:hover:scale-100 text-sm">
            {loading ? t('reset.saving') : t('reset.save')}
          </button>
        </form>

        <p className="text-center text-text-secondary text-xs mt-4">
          <Link to="/forgot-password" className="text-[#2ecc71] hover:underline">{t('reset.back')}</Link>
        </p>
      </div>
    </div>
  )
}
