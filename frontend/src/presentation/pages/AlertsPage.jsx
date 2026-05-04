import { useState } from 'react'
import { ShieldAlert, Plus, Trash2, ToggleLeft, ToggleRight, Edit2 } from 'lucide-react'
import { useAlerts } from '../../application/hooks/useAlerts'
import { useServices } from '../../application/hooks/useServices'
import { ConfirmModal } from '../components/ConfirmModal'

const CONDITION_LABELS = {
  consecutive_failures: 'Fallos consecutivos',
  latency_above: 'Latencia mayor a (ms)',
}

function RuleModal({ services, onClose, onSave, initialData = null }) {
  const [form, setForm] = useState(initialData ?? {
    service: services[0]?.id ?? '',
    condition: 'consecutive_failures',
    threshold: 3,
    channel: 'email',
    contact: '',
  })
  const [saving, setSaving] = useState(false)

  const isEdit = !!initialData
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-subtle rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-text-primary font-black text-2xl mb-6 tracking-tight">
          {isEdit ? 'Editar regla' : 'Nueva regla de alerta'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isEdit && (
            <div>
              <label className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-2 block">Servicio</label>
              <select
                value={form.service}
                onChange={e => set('service', e.target.value)}
                className="w-full bg-bg-card border border-border-subtle text-text-primary px-4 py-3 rounded-2xl text-sm focus:outline-none focus:border-[#2ecc71] transition-colors appearance-none"
                required
              >
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-2 block">Condición</label>
            <select
              value={form.condition}
              onChange={e => set('condition', e.target.value)}
              className="w-full bg-bg-card border border-border-subtle text-text-primary px-4 py-3 rounded-2xl text-sm focus:outline-none focus:border-[#2ecc71] transition-colors appearance-none"
            >
              {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-2 block">
              {form.condition === 'consecutive_failures' ? 'Número de fallos' : 'Umbral en ms'}
            </label>
            <input
              type="number"
              min={1}
              value={form.threshold}
              onChange={e => set('threshold', Number(e.target.value))}
              className="w-full bg-bg-card border border-border-subtle text-text-primary px-4 py-3 rounded-2xl text-sm focus:outline-none focus:border-[#2ecc71] transition-colors"
              required
            />
          </div>

          <div>
            <label className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-2 block">Email de contacto</label>
            <input
              type="email"
              value={form.contact}
              onChange={e => set('contact', e.target.value)}
              placeholder="alert@example.com"
              className="w-full bg-bg-card border border-border-subtle text-text-primary px-4 py-3 rounded-2xl text-sm focus:outline-none focus:border-[#2ecc71] transition-colors"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border-subtle text-text-secondary py-3 rounded-2xl text-sm font-bold hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#2ecc71] text-[#0f0f1a] font-black py-3 rounded-2xl text-sm disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear regla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AlertsPage() {
  const { rules, loading, createRule, updateRule, deleteRule, toggleRule } = useAlerts()
  const { services } = useServices()
  const [modalState, setModalState] = useState({ isOpen: false, data: null })
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null })

  const handleSave = async (formData) => {
    if (modalState.data) {
      await updateRule(modalState.data.id, formData)
    } else {
      await createRule(formData)
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-6 mb-12">
        <div>
          <h2 className="text-text-primary text-4xl font-black tracking-tight mb-2">Alertas</h2>
          <p className="text-text-secondary text-base">Gestiona tus reglas de notificación inteligente</p>
        </div>
        <button
          onClick={() => setModalState({ isOpen: true, data: null })}
          className="flex items-center gap-2 bg-[#2ecc71] text-[#0f0f1a] font-black px-6 py-3 rounded-2xl text-sm hover:bg-[#27ae60] transition-all hover:scale-[1.05] active:scale-[0.95] shadow-lg shadow-[#2ecc71]/20"
        >
          <Plus size={18} strokeWidth={3} />
          Nueva regla
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-bg-card/50 border border-border-subtle rounded-[2rem] animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-bg-card border border-border-subtle rounded-[3rem] p-16 flex flex-col items-center text-center max-w-2xl mx-auto mt-16 shadow-2xl">
          <div className="bg-red-500/10 p-8 rounded-[2.5rem] mb-8">
            <ShieldAlert size={64} className="text-red-400" />
          </div>
          <h3 className="text-text-primary text-2xl font-black mb-4">Sin reglas activas</h3>
          <p className="text-text-secondary text-lg mb-10 leading-relaxed max-w-md">
            Configura notificaciones automáticas para actuar de inmediato ante fallos críticos de tus servicios.
          </p>
          <button
            onClick={() => setModalState({ isOpen: true, data: null })}
            className="bg-[#2ecc71] text-[#0f0f1a] font-black px-10 py-4 rounded-2xl text-base shadow-xl shadow-[#2ecc71]/20 hover:scale-105 transition-transform"
          >
            Crear primera regla
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {rules.map(rule => (
            <div key={rule.id} className="group bg-bg-card border border-border-subtle rounded-[2rem] px-8 py-6 flex items-center gap-6 hover:border-[#2ecc71]/30 transition-all hover:shadow-xl hover:shadow-[#2ecc71]/5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <p className="text-text-primary text-lg font-bold truncate">{rule.service_name}</p>
                  {!rule.is_active && (
                    <span className="bg-white/5 text-text-secondary text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">
                      Inactiva
                    </span>
                  )}
                </div>
                <p className="text-text-secondary text-sm font-medium opacity-80">
                  {CONDITION_LABELS[rule.condition]} <span className="text-[#2ecc71]">›</span> {rule.threshold} 
                  <span className="mx-2 opacity-30">|</span>
                  <span className="text-text-primary/60">{rule.contact}</span>
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleRule(rule)}
                  className="p-2 text-text-secondary hover:text-[#2ecc71] transition-colors"
                  title={rule.is_active ? 'Desactivar' : 'Activar'}
                >
                  {rule.is_active
                    ? <ToggleRight size={28} className="text-[#2ecc71]" />
                    : <ToggleLeft size={28} />
                  }
                </button>

                <div className="w-[1px] h-8 bg-border-subtle mx-2" />

                <button
                  onClick={() => setModalState({ isOpen: true, data: rule })}
                  className="p-3 text-text-secondary hover:text-[#2ecc71] hover:bg-[#2ecc71]/10 rounded-xl transition-all"
                  title="Editar"
                >
                  <Edit2 size={18} />
                </button>

                <button
                  onClick={() => setConfirmDelete({ isOpen: true, id: rule.id })}
                  className="p-3 text-text-secondary hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                  title="Eliminar"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalState.isOpen && (
        <RuleModal
          services={services}
          onClose={() => setModalState({ isOpen: false, data: null })}
          onSave={handleSave}
          initialData={modalState.data}
        />
      )}

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, id: null })}
        onConfirm={() => deleteRule(confirmDelete.id)}
        title="¿Eliminar regla?"
        message="Esta regla de alerta dejará de funcionar inmediatamente. No podrás recuperar esta configuración."
        confirmText="Eliminar permanentemente"
        variant="danger"
      />
    </div>
  )
}
