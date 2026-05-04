import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Clock, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { useServiceDetail } from '../../application/hooks/useServiceDetail'
import { StatusBadge } from '../components/StatusBadge'
import { LatencyChart } from '../components/LatencyChart'
import { StatusTimeline } from '../components/StatusTimeline'
import { cn } from '../../infrastructure/utils'

export function ServiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { service, history, loading, ping } = useServiceDetail(id)

  const [sort, setSort] = useState({ key: 'checked_at', dir: 'desc' })
  const [filter, setFilter] = useState('')

  const stats = useMemo(() => {
    if (!history || history.length === 0) return null
    const upCount = history.filter(h => h.status === 'up').length
    const uptime = ((upCount / history.length) * 100).toFixed(2)
    const outages = history.filter(h => h.status === 'down').length
    return { uptime, outages }
  }, [history])

  const filteredHistory = useMemo(() => {
    if (!history) return []

    let result = history.filter(h =>
      h.status.toLowerCase().includes(filter.toLowerCase()) ||
      (h.error_message && h.error_message.toLowerCase().includes(filter.toLowerCase())) ||
      (h.status_code && h.status_code.toString().includes(filter))
    )

    return result.sort((a, b) => {
      let aVal = a[sort.key]
      let bVal = b[sort.key]

      if (sort.key === 'checked_at') {
        aVal = new Date(aVal).getTime()
        bVal = new Date(bVal).getTime()
      }

      if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1
      if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
  }, [history, sort, filter])

  const handleSort = (key) => {
    setSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
    }))
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCw size={32} className="text-[#2ecc71] animate-spin" />
        <p className="text-text-secondary animate-pulse font-medium">Obteniendo detalles...</p>
      </div>
    )
  }

  if (!service) return null

  return (
    <div className="w-full space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2.5 rounded-xl bg-bg-card border border-border-subtle text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-text-primary text-2xl font-black tracking-tight">{service.name}</h2>
              <StatusBadge status={service.status} />
            </div>
            <p className="text-text-secondary text-xs font-mono opacity-80">{service.url}</p>
          </div>
        </div>

        <button
          onClick={ping}
          className="flex items-center justify-center gap-2 bg-[#2ecc71] text-[#0f0f1a] font-black px-6 py-3 rounded-xl hover:bg-[#27ae60] transition-all hover:scale-105 active:scale-95 shadow-lg shadow-green-500/20"
        >
          <RefreshCw size={18} />
          Ejecutar Ping
        </button>
      </div>

      {/* Stats Bento Box */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-bg-card border border-border-subtle p-5 rounded-3xl">
          <p className="text-text-secondary text-[10px] uppercase font-black tracking-widest mb-2">Uptime</p>
          <p className="text-green-500 font-black text-2xl tracking-tighter">{stats?.uptime || '100'}%</p>
        </div>
        <div className="bg-bg-card border border-border-subtle p-5 rounded-3xl">
          <p className="text-text-secondary text-[10px] uppercase font-black tracking-widest mb-2">Outages</p>
          <p className="text-red-500 font-black text-2xl tracking-tighter">{stats?.outages || '0'}</p>
        </div>
        <div className="bg-bg-card border border-border-subtle p-5 rounded-3xl">
          <p className="text-text-secondary text-[10px] uppercase font-black tracking-widest mb-2">Frecuencia</p>
          <p className="text-blue-500 font-black text-2xl tracking-tighter">{service.check_interval_seconds}s</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 shadow-sm overflow-hidden">
            <h3 className="text-text-primary font-bold mb-6 flex items-center gap-2">
              <Activity size={18} className="text-blue-500" />
              Latencia en tiempo real
            </h3>
            <div className="h-[300px] w-full">
              <LatencyChart history={history} />
            </div>
          </div>

          <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 shadow-sm">
            <h3 className="text-text-primary font-bold mb-4 flex items-center gap-2 text-sm">
              <Clock size={18} className="text-emerald-500" />
              Disponibilidad Reciente
            </h3>
            <StatusTimeline history={history} limit={50} />
            <div className="flex justify-between mt-3 text-[10px] text-text-secondary uppercase tracking-widest font-black opacity-60">
              <span>Hace 50 pings</span>
              <span>Ahora</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col">
          <div className="bg-bg-card border border-border-subtle rounded-3xl shadow-sm overflow-hidden flex flex-col h-full max-h-[567px]">
            <div className="p-5 border-b border-border-subtle flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-text-primary font-bold text-sm">Historial</h3>
                <span className="text-[10px] font-black bg-bg-main text-text-secondary px-2 py-1 rounded-lg">
                  {filteredHistory.length} entradas
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                <input
                  type="text"
                  placeholder="Filtrar eventos..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="bg-bg-main border border-border-subtle text-xs text-text-primary px-9 py-2 rounded-xl w-full focus:outline-none focus:border-[#2ecc71] transition-all"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-bg-card z-10">
                  <tr className="border-b border-border-subtle text-text-secondary text-[10px] uppercase tracking-wider font-black">
                    <th className="px-4 py-3 text-center cursor-pointer hover:text-text-primary" onClick={() => handleSort('status')}>
                      UP
                    </th>
                    <th className="px-4 py-3 text-center cursor-pointer hover:text-text-primary" onClick={() => handleSort('status_code')}>
                      COD
                    </th>
                    <th className="px-4 py-3 text-center cursor-pointer hover:text-text-primary" onClick={() => handleSort('response_time_ms')}>
                      LAT
                    </th>
                    <th className="px-4 py-3 text-center cursor-pointer hover:text-text-primary" onClick={() => handleSort('checked_at')}>
                      FECHA
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/30">
                  {filteredHistory.map((c) => (
                    <tr key={c.id} className="hover:bg-bg-main/50 transition-colors group text-center">
                      <td className="px-4 py-3 flex justify-center"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-text-secondary font-mono text-xs">{c.status_code ?? '—'}</td>
                      <td className="px-4 py-3 text-text-primary font-black text-xs">
                        {c.response_time_ms != null ? `${Math.round(c.response_time_ms)}ms` : '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary font-mono text-[10px] whitespace-nowrap">
                        {c.checked_at ? new Date(c.checked_at).toLocaleString('es-CO', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—'}
                      </td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-4 py-10 text-center text-text-secondary text-xs italic">
                        Sin resultados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Activity({ className, size }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  )
}
