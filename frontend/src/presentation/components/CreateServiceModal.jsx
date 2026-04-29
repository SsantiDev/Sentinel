import { useState } from 'react'
import apiClient from '../../infrastructure/apiClient'

export function CreateServiceModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', url: '', check_interval_seconds: 60, is_active: true })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await apiClient.post('/services/', form)
      onSuccess()
      onClose()
    } catch {
      setError('Error al crear el servicio')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#2ecc71]"

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl p-8 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white text-xl font-bold">Nuevo Servicio</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className={inputClass} placeholder="Nombre" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <input className={inputClass} placeholder="URL (https://...)" value={form.url} onChange={e => setForm({...form, url: e.target.value})} required />
          <input type="number" className={inputClass} placeholder="Intervalo (segundos)" value={form.check_interval_seconds} onChange={e => setForm({...form, check_interval_seconds: parseInt(e.target.value)})} min={10} required />
          <label className="flex items-center gap-3 text-gray-400 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="w-4 h-4 accent-[#2ecc71]" />
            Activo
          </label>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-[#2ecc71] text-[#0f0f1a] font-bold py-3 rounded-lg hover:bg-[#27ae60] transition-colors disabled:opacity-50">
            {loading ? 'Creando...' : 'Crear Servicio'}
          </button>
        </form>
      </div>
    </div>
  )
}
