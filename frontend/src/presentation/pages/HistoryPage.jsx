import { Search, CheckCircle2, XCircle, HelpCircle } from 'lucide-react'
import { useHistory } from '../../application/hooks/useHistory'
import { useServices } from '../../application/hooks/useServices'

function StatusIcon({ status }) {
  if (status === 'up') return <CheckCircle2 size={16} className="text-[#2ecc71]" />
  if (status === 'down') return <XCircle size={16} className="text-red-400" />
  return <HelpCircle size={16} className="text-yellow-400" />
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export function HistoryPage() {
  const { checks, loading, filters, setFilters } = useHistory()
  const { services } = useServices()

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-text-primary text-3xl font-black tracking-tight mb-1">Historial Global</h2>
          <p className="text-text-secondary text-sm">Registro de todos los pings realizados</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <select
            value={filters.service}
            onChange={e => setFilters(f => ({ ...f, service: e.target.value }))}
            className="bg-bg-card border border-border-subtle text-text-primary pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:border-[#2ecc71] appearance-none min-w-[180px]"
          >
            <option value="">Todos los servicios</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="bg-bg-card border border-border-subtle text-text-primary px-4 py-2 rounded-xl text-sm focus:outline-none focus:border-[#2ecc71]"
        >
          <option value="">Todos los estados</option>
          <option value="up">Up</option>
          <option value="down">Down</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-text-secondary">
              <th className="text-left px-5 py-3 font-medium">Estado</th>
              <th className="text-left px-5 py-3 font-medium">Servicio</th>
              <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Latencia</th>
              <th className="text-left px-5 py-3 font-medium hidden md:table-cell">HTTP</th>
              <th className="text-left px-5 py-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border-subtle">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-4 bg-border-subtle rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : checks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-text-secondary">
                  Sin registros
                </td>
              </tr>
            ) : checks.map(c => (
              <tr key={c.id} className="border-b border-border-subtle last:border-0 hover:bg-white/5 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={c.status} />
                    <span className="capitalize text-text-primary">{c.status}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-text-primary">{c.service_name}</td>
                <td className="px-5 py-3 text-text-secondary hidden md:table-cell">
                  {c.response_time_ms != null ? `${Math.round(c.response_time_ms)} ms` : '—'}
                </td>
                <td className="px-5 py-3 hidden md:table-cell">
                  <span className={c.status_code >= 400 || !c.status_code ? 'text-red-400' : 'text-[#2ecc71]'}>
                    {c.status_code ?? '—'}
                  </span>
                </td>
                <td className="px-5 py-3 text-text-secondary">{formatDate(c.checked_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
