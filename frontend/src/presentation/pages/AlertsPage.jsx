import { ShieldAlert } from 'lucide-react'

export function AlertsPage() {
  return (
    <div className="w-full">
      <div className="mb-10">
        <h2 className="text-text-primary text-3xl font-black tracking-tight mb-2">Alertas</h2>
        <p className="text-text-secondary text-sm">Configuración de notificaciones y umbrales críticos</p>
      </div>

      <div className="bg-bg-card border border-border-subtle rounded-3xl p-12 flex flex-col items-center text-center max-w-2xl mx-auto mt-20">
        <div className="bg-red-500/10 p-6 rounded-3xl mb-6">
          <ShieldAlert size={48} className="text-red-400" />
        </div>
        <h3 className="text-text-primary text-xl font-bold mb-3">Módulo de Alertas</h3>
        <p className="text-text-secondary mb-8 leading-relaxed">
          Próximamente podrás configurar reglas personalizadas para recibir notificaciones vía Email, Slack o Telegram cuando tus servicios presenten fallos.
        </p>
        <button className="bg-[#2ecc71] text-[#0f0f1a] font-bold px-8 py-3 rounded-xl opacity-50 cursor-not-allowed">
          Próximamente
        </button>
      </div>
    </div>
  )
}
