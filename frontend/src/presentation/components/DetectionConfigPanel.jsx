import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2, Check } from 'lucide-react'
import apiClient from '../../infrastructure/apiClient'

const FIELDS = [
  { key: 'window_seconds', label: 'config.windowSeconds' },
  { key: 'morning_limit', label: 'config.morningLimit' },
  { key: 'afternoon_limit', label: 'config.afternoonLimit' },
  { key: 'night_limit', label: 'config.nightLimit' },
]

export function DetectionConfigPanel() {
  const { t } = useTranslation()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiClient.get('/detection-config/')
      .then(({ data }) => setForm(data))
      .catch((err) => setError(err.message))
  }, [])

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = Object.fromEntries(
        FIELDS.map((f) => [f.key, Math.max(1, parseInt(form[f.key], 10) || 1)])
      )
      payload.require_signature = !!form.require_signature
      const { data } = await apiClient.put('/detection-config/', payload)
      setForm(data)
      setSaved(true)
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!form) return null

  return (
    <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 mb-10">
      <div className="flex items-center gap-3 mb-1">
        <Settings2 className="text-text-secondary" size={18} />
        <h3 className="text-sm font-black text-text-primary uppercase tracking-widest">
          {t('config.title')}
        </h3>
      </div>
      <p className="text-text-secondary text-xs mb-5">{t('config.subtitle')}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">
              {t(f.label)}
            </label>
            <input
              type="number"
              min="1"
              value={form[f.key]}
              onChange={(e) => handleChange(f.key, e.target.value)}
              className="w-full bg-bg-main border border-border-subtle rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
        ))}
      </div>

      <div className="flex items-start justify-between gap-4 mt-6 pt-5 border-t border-border-subtle">
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">
            {t('anomalies.config.requireSignature')}
          </p>
          <p className="text-text-secondary text-xs">{t('anomalies.config.requireSignatureDesc')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!form.require_signature}
          onClick={() => handleChange('require_signature', !form.require_signature)}
          className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
            form.require_signature ? 'bg-orange-500' : 'bg-border-subtle'
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
              form.require_signature ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>
      <p className="text-text-secondary text-[10px] mt-2">
        {form.require_signature ? t('anomalies.config.on') : t('anomalies.config.off')}
      </p>

      {error && <p className="text-red-500 text-xs mt-3">{error}</p>}

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-orange-500 text-white text-xs font-black uppercase tracking-wider hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {saving ? '...' : t('config.save')}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
            <Check size={14} /> {t('config.saved')}
          </span>
        )}
      </div>
    </div>
  )
}
