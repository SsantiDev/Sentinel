import { useMemo } from 'react'
import { Activity, ShieldCheck, ShieldAlert, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export function SummaryCards({ services }) {
  const { t } = useTranslation()
  const total = services.length
  const up = services.filter(s => s.is_active && s.status === 'up').length
  const down = services.filter(s => s.is_active && s.status === 'down').length
  const activeCount = services.filter(s => s.is_active).length
  const uptimePercent = activeCount > 0 ? ((up / activeCount) * 100).toFixed(1) : '100'

  // Calculate average response time
  const avgLatency = useMemo(() => {
    const servicesWithLatency = services.filter(s => s.response_time_ms != null)
    if (servicesWithLatency.length === 0) return 0
    const sum = servicesWithLatency.reduce((acc, s) => acc + s.response_time_ms, 0)
    return Math.round(sum / servicesWithLatency.length)
  }, [services])

  const cards = [
    {
      title: t('summary.avgLatency'),
      value: `${avgLatency}ms`,
      icon: Zap,
      color: 'from-blue-500/20 to-indigo-500/5',
      textColor: 'text-blue-500',
      desc: t('summary.globalAvg')
    },
    {
      title: t('summary.availability'),
      value: `${uptimePercent}%`,
      icon: Activity,
      color: 'from-green-500/20 to-emerald-500/5',
      textColor: 'text-green-500',
      desc: t('summary.globalAvgShort')
    },
    {
      title: t('summary.activeServices'),
      value: up,
      icon: ShieldCheck,
      color: 'from-emerald-500/20 to-teal-500/5',
      textColor: 'text-emerald-500',
      desc: t('summary.operational')
    },
    {
      title: t('summary.incidents'),
      value: down,
      icon: ShieldAlert,
      color: down > 0 ? 'from-red-500/20 to-orange-500/5' : 'from-gray-500/10 to-gray-500/5',
      textColor: down > 0 ? 'text-red-500' : 'text-text-secondary',
      desc: t('summary.needAttention')
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
      {cards.map((card, idx) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className={`bg-bg-card border border-border-subtle p-6 rounded-3xl relative overflow-hidden group hover:border-border-subtle transition-all`}
        >
          {/* Accent Background */}
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
