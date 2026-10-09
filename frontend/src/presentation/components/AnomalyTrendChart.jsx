import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../application/context/ThemeContext'

// Punto resaltado sobre la linea de anomalias cuando ese dia es un pico
// repentino. Los dias normales no dibujan punto (mantiene la linea limpia).
function SpikeDot({ cx, cy, payload, index, spikeDates }) {
  if (!spikeDates.has(payload.rawDate)) return <g key={index} />
  return (
    <g key={index}>
      <circle cx={cx} cy={cy} r={5} fill="#e74c3c" stroke="#fff" strokeWidth={2} />
    </g>
  )
}

export function AnomalyTrendChart({ dailyEvolution, spikeDates }) {
  const { isDark } = useTheme()
  const { t } = useTranslation()
  const spikes = spikeDates || new Set()
  const data = dailyEvolution.map((d) => ({
    rawDate: d.date,
    date: new Date(d.date).toLocaleDateString([], { day: '2-digit', month: '2-digit' }),
    transactions: d.transaction_count,
    anomalies: d.anomaly_count,
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
            dataKey="date"
            tick={{ fill: colors.text, fontSize: 10, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            dy={10}
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
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Line type="monotone" dataKey="transactions" name={t('anomalies.table.transactionCount')} stroke="#2ecc71" dot={false} strokeWidth={2} animationDuration={1000} />
          <Line
            type="monotone"
            dataKey="anomalies"
            name={t('nav.anomalies')}
            stroke="#e74c3c"
            dot={(props) => <SpikeDot {...props} spikeDates={spikes} />}
            strokeWidth={2}
            animationDuration={1000}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
