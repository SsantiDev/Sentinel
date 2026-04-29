import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useServiceDetail } from '../../application/hooks/useServiceDetail'
import { StatusBadge } from '../components/StatusBadge'
import { LatencyChart } from '../components/LatencyChart'
import { StatusTimeline } from '../components/StatusTimeline'

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

  const SortIcon = ({ column }) => {
    if (sort.key !== column) return <span className="opacity-20 ml-1 text-[8px]">↕</span>
    return <span className="ml-1 text-[8px] text-blue-400">{sort.dir === 'desc' ? '↓' : '↑'}</span>
  }

  if (loading) return <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center text-gray-400">Cargando...</div>
  if (!service) return null

  return (
    <div className="min-h-screen bg-[#0f0f1a]">
      <header className="border-b border-[#2a2a3e] px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white transition-colors">← Volver</button>
        <h1 className="text-white font-bold text-xl">{service.name}</h1>
        <StatusBadge status={service.status} />
      </header>
      <main className="p-6 space-y-6 w-full mx-auto">
        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6 flex flex-wrap items-center justify-between gap-6 shadow-xl">
          <div className="flex-1 min-w-[200px]">
            <p className="text-gray-400 text-sm font-mono opacity-70">{service.url}</p>
            <div className="flex gap-4 mt-4">
              <div className="bg-[#0f0f1a] px-4 py-3 rounded-xl border border-[#2a2a3e] min-w-[100px]">
                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Uptime</p>
                <p className="text-green-400 font-bold text-xl">{stats?.uptime || '100'}%</p>
              </div>
              <div className="bg-[#0f0f1a] px-4 py-3 rounded-xl border border-[#2a2a3e] min-w-[100px]">
                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Fallos</p>
                <p className="text-red-400 font-bold text-xl">{stats?.outages || '0'}</p>
              </div>
              <div className="bg-[#0f0f1a] px-4 py-3 rounded-xl border border-[#2a2a3e] min-w-[100px]">
                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Intervalo</p>
                <p className="text-blue-400 font-bold text-xl">{service.check_interval_seconds}s</p>
              </div>
            </div>
          </div>
          <button
            onClick={ping}
            className="bg-[#2ecc71] text-[#0f0f1a] font-bold px-8 py-4 rounded-xl hover:bg-[#27ae60] transition-all hover:scale-105 active:scale-95 text-sm shadow-lg shadow-green-500/20"
          >
            Ejecutar Ping
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <LatencyChart history={history} />
            
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5 shadow-lg">
              <h3 className="text-gray-400 text-sm font-medium mb-4">Disponibilidad Reciente</h3>
              <StatusTimeline history={history} limit={50} />
              <div className="flex justify-between mt-3 text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                <span>Hace 50 pings</span>
                <span>Ahora</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl shadow-lg overflow-hidden flex flex-col h-full max-h-[600px]">
              <div className="px-5 py-4 border-b border-[#2a2a3e] bg-[#1a1a2e]/50 flex items-center justify-between gap-4">
                <h3 className="text-white font-semibold text-sm whitespace-nowrap">Historial</h3>
                <input
                  type="text"
                  placeholder="Filtrar historial..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="bg-[#0f0f1a] border border-[#2a2a3e] text-xs text-white px-3 py-1.5 rounded-lg w-full max-w-[150px] focus:outline-none focus:border-blue-500/50 transition-all shadow-inner"
                />
              </div>
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#1a1a2e] z-10 shadow-sm">
                    <tr className="border-b border-[#2a2a3e] text-gray-400 text-[9px] uppercase tracking-wider font-bold">
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors group" onClick={() => handleSort('status')}>
                        <div className="flex items-center gap-1">
                          Estado
                          <svg className={`opacity-0 group-hover:opacity-100 transition-opacity ${sort.key === 'status' ? 'opacity-100 text-blue-400' : ''}`} xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                          </svg>
                          <SortIcon column="status" />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors group" onClick={() => handleSort('status_code')}>
                        <div className="flex items-center gap-1">
                          Cod
                          <svg className={`opacity-0 group-hover:opacity-100 transition-opacity ${sort.key === 'status_code' ? 'opacity-100 text-blue-400' : ''}`} xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                          </svg>
                          <SortIcon column="status_code" />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors group" onClick={() => handleSort('response_time_ms')}>
                        <div className="flex items-center gap-1">
                          Lat
                          <svg className={`opacity-0 group-hover:opacity-100 transition-opacity ${sort.key === 'response_time_ms' ? 'opacity-100 text-blue-400' : ''}`} xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                          </svg>
                          <SortIcon column="response_time_ms" />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors group" onClick={() => handleSort('checked_at')}>
                        <div className="flex items-center gap-1">
                          Fecha
                          <svg className={`opacity-0 group-hover:opacity-100 transition-opacity ${sort.key === 'checked_at' ? 'opacity-100 text-blue-400' : ''}`} xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                          </svg>
                          <SortIcon column="checked_at" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((c) => (
                      <tr key={c.id} className="border-b border-[#2a2a3e] last:border-0 hover:bg-[#0f0f1a] transition-colors">
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3 text-gray-300 font-mono">{c.status_code ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-300 font-medium">{c.response_time_ms != null ? `${Math.round(c.response_time_ms)}ms` : '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-[11px] whitespace-nowrap">{new Date(c.checked_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {filteredHistory.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-4 py-10 text-center text-gray-500 text-xs italic">No hay resultados que coincidan</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
