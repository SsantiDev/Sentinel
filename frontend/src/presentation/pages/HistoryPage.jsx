import { History, Search } from 'lucide-react'

export function HistoryPage() {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-text-primary text-3xl font-black tracking-tight mb-2">Historial Global</h2>
          <p className="text-text-secondary text-sm">Registro histórico de todos los pings realizados</p>
        </div>
        
        <div className="relative group hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input
            type="text"
            placeholder="Buscar en el historial..."
            className="bg-bg-card border border-border-subtle text-text-primary pl-10 pr-4 py-2.5 rounded-xl w-64 focus:outline-none focus:border-[#2ecc71] transition-all"
          />
        </div>
      </div>

      <div className="bg-bg-card border border-border-subtle rounded-3xl p-12 flex flex-col items-center text-center max-w-2xl mx-auto mt-20">
        <div className="bg-blue-500/10 p-6 rounded-3xl mb-6">
          <History size={48} className="text-blue-400" />
        </div>
        <h3 className="text-text-primary text-xl font-bold mb-3">Historial de Eventos</h3>
        <p className="text-text-secondary mb-8 leading-relaxed">
          Aquí se mostrará un log detallado de cada verificación realizada por Sentinel, permitiéndote auditar el rendimiento a largo plazo de tu infraestructura.
        </p>
        <div className="flex gap-4">
          <div className="h-2 w-24 bg-border-subtle rounded-full animate-pulse"></div>
          <div className="h-2 w-32 bg-border-subtle rounded-full animate-pulse delay-75"></div>
          <div className="h-2 w-16 bg-border-subtle rounded-full animate-pulse delay-150"></div>
        </div>
      </div>
    </div>
  )
}
