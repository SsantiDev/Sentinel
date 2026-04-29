import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatusBadge } from './StatusBadge'
import { StatusTimeline } from './StatusTimeline'

export function ServiceCard({ service }) {
  const navigate = useNavigate()
  const lastChecked = service.last_checked_at
    ? new Date(service.last_checked_at).toLocaleString()
    : '—'

  const uptime = useMemo(() => {
    if (!service.recent_history || service.recent_history.length === 0) return null
    const upCount = service.recent_history.filter(h => h.status === 'up').length
    return ((upCount / service.recent_history.length) * 100).toFixed(1)
  }, [service.recent_history])

  return (
    <div
      onClick={() => navigate(`/services/${service.id}`)}
      className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5 cursor-pointer hover:border-[#3a3a5e] transition-all hover:-translate-y-1"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="truncate pr-2">
          <h3 className="text-white font-semibold text-lg truncate">{service.name}</h3>
          {uptime && <span className="text-[10px] text-green-400 font-bold bg-green-400/10 px-1.5 py-0.5 rounded">{uptime}% Uptime</span>}
        </div>
        <StatusBadge status={service.status} />
      </div>
      <p className="text-gray-400 text-sm truncate mb-4">{service.url}</p>
      
      <div className="mb-4">
        <StatusTimeline history={service.recent_history} limit={20} />
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        <span>{service.response_time_ms != null ? `${Math.round(service.response_time_ms)} ms` : '—'}</span>
        <span>{lastChecked}</span>
      </div>
    </div>
  )
}
