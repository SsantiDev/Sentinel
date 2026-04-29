import { useNavigate } from 'react-router-dom'
import { StatusBadge } from './StatusBadge'

export function ServiceCard({ service }) {
  const navigate = useNavigate()
  const lastChecked = service.last_checked_at
    ? new Date(service.last_checked_at).toLocaleString()
    : '—'

  return (
    <div
      onClick={() => navigate(`/services/${service.id}`)}
      className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5 cursor-pointer hover:border-[#3a3a5e] transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-white font-semibold text-lg truncate pr-2">{service.name}</h3>
        <StatusBadge status={service.status} />
      </div>
      <p className="text-gray-400 text-sm truncate mb-4">{service.url}</p>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{service.response_time_ms != null ? `${Math.round(service.response_time_ms)} ms` : '—'}</span>
        <span>{lastChecked}</span>
      </div>
    </div>
  )
}
