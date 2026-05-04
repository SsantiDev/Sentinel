import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Clock, BarChart3 } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { StatusTimeline } from './StatusTimeline'
import { cn } from '../../infrastructure/utils'

export function ServiceCard({ service }) {
  const navigate = useNavigate()
  
  const uptime = useMemo(() => {
    if (!service.recent_history || service.recent_history.length === 0) return null
    const upCount = service.recent_history.filter(h => h.status === 'up').length
    return ((upCount / service.recent_history.length) * 100).toFixed(1)
  }, [service.recent_history])

  return (
    <article
      onClick={() => navigate(`/services/${service.id}`)}
      className="group bg-bg-card border border-border-subtle rounded-2xl cursor-pointer hover:border-[#2ecc71]/50 hover:bg-border-subtle/20 transition-all duration-300 hover:shadow-xl relative overflow-hidden flex flex-col h-full"
    >
      {/* Decorative element */}
      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <ExternalLink size={14} className="text-text-secondary" />
      </div>

      <header className="p-6 pb-4 flex items-start justify-between">
        <div className="truncate flex-1">
          <h3 className="text-text-primary font-bold text-lg truncate group-hover:text-[#2ecc71] transition-colors">
            {service.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-text-secondary text-[11px] truncate font-mono opacity-80">{service.url}</p>
          </div>
        </div>
        <StatusBadge status={service.status} />
      </header>
      
      <main className="px-6 py-2 flex-1">
        <div className="bg-bg-main/50 p-3 rounded-xl border border-border-subtle/50">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Disponibilidad</span>
            {uptime && <span className="text-[10px] text-green-500 font-black">{uptime}%</span>}
          </div>
          <StatusTimeline history={service.recent_history} limit={20} />
        </div>
      </main>

      <footer className="p-6 pt-4 mt-auto border-t border-border-subtle/30 flex items-center justify-between text-[11px] font-medium">
        <div className="flex items-center gap-1.5 text-blue-500">
          <Clock size={12} />
          <span>{service.response_time_ms != null ? `${Math.round(service.response_time_ms)}ms` : '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-text-secondary">
          <BarChart3 size={12} />
          <span>{service.last_checked_at ? 'Activo' : 'Pendiente'}</span>
        </div>
      </footer>
    </article>
  )
}
