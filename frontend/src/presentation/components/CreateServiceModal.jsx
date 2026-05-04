import { useState } from 'react'
import { X, Server, Globe, Clock, Shield } from 'lucide-react'
import apiClient from '../../infrastructure/apiClient'
import { cn } from '../../infrastructure/utils'

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

  const inputClass = "w-full bg-bg-main border border-border-subtle rounded-xl px-11 py-3 text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-[#2ecc71] transition-all"

  return (
    <div className="fixed inset-0 bg-[#0f0f1a]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-subtle rounded-[32px] p-8 w-full max-w-md shadow-2xl relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#2ecc71]/5 rounded-full blur-3xl"></div>
        
        <div className="flex justify-between items-center mb-8 relative z-10">
          <div>
            <h2 className="text-text-primary text-2xl font-black tracking-tight">Nuevo Servicio</h2>
            <p className="text-text-secondary text-xs font-medium">Configura un nuevo endpoint para monitoreo</p>
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
              placeholder="Nombre del servicio (ej: API Principal)" 
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})} 
              required 
            />
          </div>

          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
            <input 
              className={inputClass} 
              placeholder="URL (https://example.com/api)" 
              value={form.url} 
              onChange={e => setForm({...form, url: e.target.value})} 
              required 
            />
          </div>

          <div className="relative">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
            <input 
              type="number" 
              className={inputClass} 
              placeholder="Intervalo en segundos (min 10s)" 
              value={form.check_interval_seconds} 
              onChange={e => setForm({...form, check_interval_seconds: parseInt(e.target.value)})} 
              min={10} 
              required 
            />
          </div>

          <label className="flex items-center gap-3 text-text-secondary cursor-pointer group px-1">
            <div className={cn(
              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
              form.is_active ? "bg-[#2ecc71] border-[#2ecc71]" : "border-border-subtle"
            )}>
              <input 
                type="checkbox" 
                checked={form.is_active} 
                onChange={e => setForm({...form, is_active: e.target.checked})} 
                className="hidden" 
              />
              {form.is_active && <div className="w-2 h-2 bg-[#0f0f1a] rounded-full" />}
            </div>
            <span className="text-sm font-bold group-hover:text-text-primary transition-colors">Activar monitoreo</span>
          </label>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl flex items-center gap-2">
              <Shield size={14} />
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-[#2ecc71] text-[#0f0f1a] font-black py-4 rounded-2xl hover:bg-[#27ae60] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-green-500/10 mt-2"
          >
            {loading ? 'Procesando...' : 'Guardar Servicio'}
          </button>
        </form>
      </div>
    </div>
  )
}
