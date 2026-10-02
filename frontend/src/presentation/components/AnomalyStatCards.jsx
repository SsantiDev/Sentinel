import { motion } from 'framer-motion'
import { AlertTriangle, Users, Percent, DollarSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
})

export function AnomalyStatCards({ stats }) {
  const { t } = useTranslation()

  const cards = [
    {
      title: t('anomalies.anomaliesToday'),
      value: stats.anomalies_today,
      icon: AlertTriangle,
      color: stats.anomalies_today > 0 ? 'from-red-500/20 to-orange-500/5' : 'from-gray-500/10 to-gray-500/5',
      textColor: stats.anomalies_today > 0 ? 'text-red-500' : 'text-text-secondary',
      desc: `${stats.anomalies_this_week} ${t('anomalies.anomaliesWeek').toLowerCase()}`,
    },
    {
      title: t('anomalies.anomalyRate'),
      value: `${stats.anomaly_rate_percent}%`,
      icon: Percent,
      color: 'from-orange-500/20 to-amber-500/5',
      textColor: 'text-orange-500',
      desc: `${stats.transactions_this_month} ${t('anomalies.transactionsMonth').toLowerCase()}`,
    },
    {
      title: t('anomalies.suspiciousValue'),
      value: currency.format(stats.suspicious_total_value || 0),
      icon: DollarSign,
      color: 'from-red-500/20 to-rose-500/5',
      textColor: 'text-rose-500',
      desc: `${stats.avg_transactions_per_user} ${t('anomalies.avgTransactionsPerUser').toLowerCase()}`,
    },
    {
      title: t('anomalies.affectedUsers'),
      value: stats.affected_users_count,
      icon: Users,
      color: 'from-blue-500/20 to-indigo-500/5',
      textColor: 'text-blue-500',
      desc: `${stats.transactions_today} ${t('anomalies.transactionsToday').toLowerCase()}`,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
      {cards.map((card, idx) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="bg-bg-card border border-border-subtle p-6 rounded-3xl relative overflow-hidden group hover:border-border-subtle transition-all"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-30 group-hover:opacity-50 transition-opacity`} />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                {card.title}
              </span>
              <card.icon className={card.textColor} size={18} />
            </div>

            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black text-text-primary tracking-tighter">
                {card.value}
              </h3>
            </div>

            <p className="text-[10px] text-text-secondary mt-2 font-medium">
              {card.desc}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
