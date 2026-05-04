import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useTheme } from '../../application/context/ThemeContext'

export function LatencyChart({ history }) {
  const { isDark } = useTheme()
  const data = [...history].reverse().map((c) => ({
    time: new Date(c.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ms: c.response_time_ms ?? 0,
  }))

  const colors = {
    grid: isDark ? '#2a2a3e' : '#e2e8f0',
    text: isDark ? '#9ca3af' : '#64748b',
    tooltipBg: isDark ? '#1a1a2e' : '#ffffff',
    tooltipBorder: isDark ? '#2a2a3e' : '#e2e8f0',
    tooltipText: isDark ? '#ffffff' : '#0f172a',
  }

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
          <XAxis 
            dataKey="time" 
            tick={{ fill: colors.text, fontSize: 10, fontWeight: 500 }} 
            axisLine={false}
            tickLine={false}
            dy={10}
          />
          <YAxis 
            tick={{ fill: colors.text, fontSize: 10, fontWeight: 500 }} 
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: colors.tooltipBg, 
              borderColor: colors.tooltipBorder, 
              borderRadius: '12px',
              fontSize: '12px',
              color: colors.tooltipText,
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
            }} 
            itemStyle={{ color: colors.tooltipText }}
          />
          <Line 
            type="monotone" 
            dataKey="ms" 
            stroke="#2ecc71" 
            dot={false} 
            strokeWidth={3}
            animationDuration={1000}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
