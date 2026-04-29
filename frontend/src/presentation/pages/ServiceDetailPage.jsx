import { useParams, useNavigate } from 'react-router-dom'
import { useServiceDetail } from '../../application/hooks/useServiceDetail'
import { StatusBadge } from '../components/StatusBadge'
import { LatencyChart } from '../components/LatencyChart'

export function ServiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { service, history, loading, ping } = useServiceDetail(id)

  if (loading) return <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center text-gray-400">Cargando...</div>
  if (!service) return null

  return (
    <div className="min-h-screen bg-[#0f0f1a]">
      <header className="border-b border-[#2a2a3e] px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white transition-colors">← Volver</button>
        <h1 className="text-white font-bold text-xl">{service.name}</h1>
        <StatusBadge status={service.status} />
      </header>
      <main className="p-6 space-y-6 max-w-4xl">
        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">{service.url}</p>
            <p className="text-gray-500 text-xs mt-1">
              {service.response_time_ms != null ? `${Math.round(service.response_time_ms)} ms` : '—'} · cada {service.check_interval_seconds}s
            </p>
          </div>
          <button
            onClick={ping}
            className="bg-[#2ecc71] text-[#0f0f1a] font-bold px-4 py-2 rounded-lg hover:bg-[#27ae60] transition-colors text-sm"
          >
            Ping ahora
          </button>
        </div>

        <LatencyChart history={history} />

        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a3e] text-gray-400 text-xs">
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Latencia</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Error</th>
              </tr>
            </thead>
            <tbody>
              {history.map((c) => (
                <tr key={c.id} className="border-b border-[#2a2a3e] last:border-0 hover:bg-[#0f0f1a]">
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-gray-300">{c.status_code ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-300">{c.response_time_ms != null ? `${Math.round(c.response_time_ms)} ms` : '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(c.checked_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-red-400 text-xs">{c.error_message ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
