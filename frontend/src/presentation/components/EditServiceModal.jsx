import { useState } from 'react'
import { X, Server, Globe, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function EditServiceModal({ service, onClose, onSave }) {
    const { t } = useTranslation()
    const [form, setForm] = useState(() => ({
        name: service?.name || '',
        url: service?.url || ''
    }))
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setError(null)
        try {
            await onSave({
                name: form.name.trim(),
                url: form.url.trim()
            })
            onClose()
        } catch {
            setError(t('service.updateError'))
        } finally {
            setSaving(false)
        }
    }

    const inputClass = "w-full bg-bg-main border border-border-subtle rounded-xl px-11 py-3 text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-[#2ecc71] transition-all"

    return (
        <div className="fixed inset-0 bg-[#0f0f1a]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-bg-card border border-border-subtle rounded-[32px] p-8 w-full max-w-md shadow-2xl relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#2ecc71]/5 rounded-full blur-3xl"></div>

                <div className="flex justify-between items-center mb-8 relative z-10">
                    <div>
                        <h2 className="text-text-primary text-2xl font-black tracking-tight">{t('service.editService')}</h2>
                        <p className="text-text-secondary text-xs font-medium">{t('service.editServiceDesc')}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-bg-main text-text-secondary hover:text-text-primary transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                    <div className="relative">
                        <Server className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                        <input
                            className={inputClass}
                            placeholder={t('service.namePlaceholder')}
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                        <input
                            type="url"
                            className={inputClass}
                            placeholder={t('service.urlPlaceholder')}
                            value={form.url}
                            onChange={e => setForm({ ...form, url: e.target.value })}
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl flex items-center gap-2">
                            <Shield size={14} />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-[#2ecc71] text-[#0f0f1a] font-black py-4 rounded-2xl hover:bg-[#27ae60] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-green-500/10 mt-2"
                    >
                        {saving ? t('service.processing') : t('service.saveChanges')}
                    </button>
                </form>
            </div>
        </div>
    )
}
