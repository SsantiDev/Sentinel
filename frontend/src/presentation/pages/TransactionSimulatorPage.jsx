import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CreditCard, Send, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react'
import apiClient from '../../infrastructure/apiClient'
import { useAuth } from '../../application/hooks/useAuth'

const PAYMENT_METHODS = ['Tarjeta', 'Efectivo', 'Transferencia', 'PSE', 'Otro']

function pad(n) {
  return String(n).padStart(2, '0')
}

// Formatea una fecha local como "YYYY-MM-DDTHH:mm:ss" (sin zona, hora tal cual).
function formatLocal(d) {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

function defaultNow() {
  return formatLocal(new Date())
}

export function TransactionSimulatorPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isSuperUser } = useAuth()

  const [form, setForm] = useState({
    user: '',
    value: 50000,
    paymentMethod: 'Tarjeta',
    date: defaultNow(),
  })
  const [burst, setBurst] = useState({ enabled: false, count: 3, intervalSeconds: 1 })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setResult(null)

    if (!form.user.trim()) {
      setError(t('sim.errors.userRequired'))
      return
    }

    setSending(true)
    try {
      // El servidor genera y firma las transacciones con la clave secreta;
      // el navegador solo envia los parametros del simulador.
      const body = {
        user: form.user.trim(),
        value: Math.max(0, parseInt(form.value, 10) || 0),
        paymentMethod: form.paymentMethod,
        date: form.date,
        count: burst.enabled ? Math.max(1, parseInt(burst.count, 10) || 1) : 1,
        intervalSeconds: burst.enabled ? Math.max(0, parseInt(burst.intervalSeconds, 10) || 0) : 0,
      }

      const { data } = await apiClient.post('/transactions/simulate/', body)
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <CreditCard className="text-[#2ecc71]" size={24} />
          <h1 className="text-2xl font-black text-text-primary tracking-tight">{t('sim.title')}</h1>
        </div>
        <p className="text-text-secondary text-sm mt-1">{t('sim.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-bg-card border border-border-subtle rounded-3xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">
              {t('sim.user')}
            </label>
            <input
              type="email"
              required
              placeholder="aa@aa.com"
              value={form.user}
              onChange={(e) => setField('user', e.target.value)}
              className="w-full bg-bg-main border border-border-subtle rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-[#2ecc71]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">
              {t('sim.value')}
            </label>
            <input
              type="number"
              min="0"
              value={form.value}
              onChange={(e) => setField('value', e.target.value)}
              className="w-full bg-bg-main border border-border-subtle rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-[#2ecc71]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">
              {t('sim.paymentMethod')}
            </label>
            <select
              value={form.paymentMethod}
              onChange={(e) => setField('paymentMethod', e.target.value)}
              className="w-full bg-bg-main border border-border-subtle rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-[#2ecc71]"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">
              {t('sim.date')}
            </label>
            <input
              type="datetime-local"
              step="1"
              value={form.date}
              onChange={(e) => setField('date', e.target.value)}
              className="w-full bg-bg-main border border-border-subtle rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-[#2ecc71]"
            />
          </div>
        </div>

        <div className="border-t border-border-subtle pt-5">
          <label className="flex items-center gap-2 text-sm text-text-primary font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={burst.enabled}
              onChange={(e) => setBurst((b) => ({ ...b, enabled: e.target.checked }))}
            />
            {t('sim.burst.toggle')}
          </label>
          <p className="text-text-secondary text-xs mt-1">{t('sim.burst.help')}</p>

          {burst.enabled && (
            <div className="grid grid-cols-2 gap-4 mt-4 max-w-sm">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">
                  {t('sim.burst.count')}
                </label>
                <input
                  type="number"
                  min="1"
                  value={burst.count}
                  onChange={(e) => setBurst((b) => ({ ...b, count: e.target.value }))}
                  className="w-full bg-bg-main border border-border-subtle rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-[#2ecc71]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">
                  {t('sim.burst.interval')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={burst.intervalSeconds}
                  onChange={(e) => setBurst((b) => ({ ...b, intervalSeconds: e.target.value }))}
                  className="w-full bg-bg-main border border-border-subtle rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-[#2ecc71]"
                />
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={sending}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2ecc71] text-white text-sm font-black uppercase tracking-wider hover:bg-[#27ae60] transition-colors disabled:opacity-50"
        >
          <Send size={16} />
          {sending ? '...' : t('sim.send')}
        </button>
      </form>

      {result && (
        <div className="mt-6 bg-bg-card border border-border-subtle rounded-3xl p-6">
          <h3 className="text-sm font-black text-text-primary uppercase tracking-widest mb-4">
            {t('sim.result.title')}
          </h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
              <CheckCircle2 size={16} /> {t('sim.result.accepted')}: {result.accepted}
            </div>
            <div className="flex items-center gap-2 text-text-secondary font-bold text-sm">
              {t('sim.result.rejected')}: {result.rejected.length}
            </div>
            <div className={`flex items-center gap-2 font-bold text-sm ${result.anomalies_detected > 0 ? 'text-red-500' : 'text-text-secondary'}`}>
              <AlertTriangle size={16} /> {t('sim.result.anomalies')}: {result.anomalies_detected}
            </div>
          </div>

          {result.rejected.length > 0 && (
            <ul className="mt-4 text-xs text-text-secondary space-y-1">
              {result.rejected.map((r, i) => (
                <li key={i}>#{r.idTxn ?? '—'} → {r.reason}</li>
              ))}
            </ul>
          )}

          {result.anomalies_detected > 0 && isSuperUser && (
            <button
              onClick={() => navigate('/anomalies')}
              className="mt-5 flex items-center gap-2 text-[#2ecc71] text-sm font-bold hover:underline"
            >
              {t('sim.result.viewDashboard')} <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
