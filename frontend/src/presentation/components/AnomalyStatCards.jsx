import { useState } from 'react'
import { motion } from 'framer-motion'
import { Percent, Users, DollarSign, Gauge } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnomalyDetailModal } from './AnomalyDetailModal'

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
})
const nf = new Intl.NumberFormat('es-CO')

export function AnomalyStatCards({ stats, anomalies }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(null)
  const all = anomalies || []

  const cards = [
    {
      title: t('anomalies.anomalyRate'),
      value: `${stats.anomaly_rate_percent}%`,
      icon: Percent,
      textColor: 'text-orange-500',
      desc: `${nf.format(stats.total_anomalies)} / ${nf.format(stats.total_transactions)}`,
      drill: { items: all, subtitle: `${nf.format(stats.total_anomalies)} ${t('anomalies.anomalyCountSuffix')}` },
    },
    {
      title: t('anomalies.suspiciousValue'),
      value: currency.format(stats.suspicious_total_value || 0),
      icon: DollarSign,
      textColor: 'text-rose-500',
      desc: `${nf.format(stats.anomalies_new)} ${t('anomalies.anomaliesNew').toLowerCase()}`,
      drill: { items: all, subtitle: `${nf.format(stats.total_anomalies)} ${t('anomalies.anomalyCountSuffix')}` },
    },
    {
      title: t('anomalies.affectedUsers'),
      value: nf.format(stats.affected_users_count),
      icon: Users,
      textColor: 'text-blue-500',
      desc: `${nf.format(stats.total_anomalies)} ${t('anomalies.anomalyCountSuffix')}`,
      drill: { items: all, subtitle: `${nf.format(stats.affected_users_count)} ${t('anomalies.affectedUsers').toLowerCase()}` },
    },
    {
      title: t('anomalies.avgTransactionsPerUser'),
      value: nf.format(stats.avg_transactions_per_user),
      icon: Gauge,
      textColor: 'text-emerald-500',
      desc: `${nf.format(stats.total_transactions)} ${t('anomalies.metricTransactions').toLowerCase()}`,
      drill: null,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {cards.map((card, idx) => {
        const Comp = card.drill ? motion.button : motion.div
        return (
          <Comp
            key={card.title}
            onClick={card.drill ? () => setSelected({ title: card.title, ...card.drill }) : undefined}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className={`bg-bg-card border border-border-subtle p-6 rounded-3xl transition-colors ${card.drill ? 'cursor-pointer text-left w-full hover:border-text-secondary/30' : ''}`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                {card.title}
              </span>
              <card.icon className={card.textColor} size={18} />
            </div>

            <h3 className="text-3xl font-black text-text-primary tracking-tighter tabular-nums">
              {card.value}
            </h3>

            <p className="text-[10px] text-text-secondary mt-2 font-medium tabular-nums">
              {card.desc}
            </p>
          </Comp>
        )
      })}

      <AnomalyDetailModal
        open={selected !== null}
        title={selected?.title || ''}
        subtitle={selected?.subtitle || ''}
        anomalies={selected?.items || []}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
