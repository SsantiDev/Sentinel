import { useMemo } from 'react'

export function SummaryCards({ services = [] }) {
  const stats = useMemo(() => {
    if (services.length === 0) return null

    const total = services.length
    const up = services.filter(s => s.status === 'up').length
    const down = services.filter(s => s.status === 'down').length
    
    // Avg Latency (of active services)
    const activeWithLatency = services.filter(s => s.response_time_ms != null)
    const avgLatency = activeWithLatency.length > 0
      ? activeWithLatency.reduce((acc, s) => acc + s.response_time_ms, 0) / activeWithLatency.length
      : 0

    // Global Uptime (average of each service's recent history uptime)
    const uptimes = services.map(s => {
      if (!s.recent_history || s.recent_history.length === 0) return 100
      const upCount = s.recent_history.filter(h => h.status === 'up').length
      return (upCount / s.recent_history.length) * 100
    })
    const globalUptime = uptimes.reduce((acc, u) => acc + u, 0) / uptimes.length

    return { total, up, down, avgLatency, globalUptime }
  }, [services])

  if (!stats) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <Card title="Uptime Global" value={`${stats.globalUptime.toFixed(2)}%`} subValue="Últimas 24h" color="text-green-400" />
      <Card title="Incidentes" value={stats.down} subValue="Servicios caídos" color={stats.down > 0 ? "text-red-400" : "text-gray-400"} />
      <Card title="Latencia Media" value={`${Math.round(stats.avgLatency)} ms`} subValue="Tiempo de respuesta" color="text-blue-400" />
      <Card title="Total Servicios" value={stats.total} subValue="Monitoreados" color="text-purple-400" />
    </div>
  )
}

function Card({ title, value, subValue, color }) {
  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5 shadow-lg">
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
      <div className={`text-2xl font-bold ${color} mb-1`}>{value}</div>
      <p className="text-gray-500 text-[10px]">{subValue}</p>
    </div>
  )
}
