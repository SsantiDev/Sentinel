import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export function LatencyChart({ history }) {
  const data = [...history].reverse().map((c) => ({
    time: new Date(c.checked_at).toLocaleTimeString(),
    ms: c.response_time_ms ?? 0,
  }))

  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5">
      <h3 className="text-gray-400 text-sm mb-4">Latencia (ms)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
          <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', color: '#fff' }} />
          <Line type="monotone" dataKey="ms" stroke="#2ecc71" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
