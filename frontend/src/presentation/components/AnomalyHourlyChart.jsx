import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useTheme } from '../../application/context/ThemeContext'

export function AnomalyHourlyChart({ hourlyDistribution }) {
  const { isDark } = useTheme()
  const data = hourlyDistribution.map((h) => ({
    hour: `${String(h.hour).padStart(2, '0')}h`,
    count: h.anomaly_count,
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
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
          <XAxis
            dataKey="hour"
            tick={{ fill: colors.text, fontSize: 10, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            dy={10}
            interval={2}
          />
          <YAxis
            tick={{ fill: colors.text, fontSize: 10, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: colors.tooltipBg,
              borderColor: colors.tooltipBorder,
              borderRadius: '12px',
              fontSize: '12px',
              color: colors.tooltipText,
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
            }}
            itemStyle={{ color: colors.tooltipText }}
          />
          <Bar dataKey="count" fill="#f39c12" radius={[6, 6, 0, 0]} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
