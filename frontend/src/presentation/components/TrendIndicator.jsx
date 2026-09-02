import { TrendingUp, Minus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function TrendIndicator({ trend }) {
  const { t } = useTranslation()
  if (!trend?.has_data) return null

  const Icon = trend.is_degrading ? TrendingUp : Minus
  const colorClass = trend.is_degrading ? 'text-orange-400' : 'text-emerald-400'

  return (
    <div className="bg-bg-card border border-border-subtle p-5 rounded-3xl">
      <p className="text-text-secondary text-[10px] uppercase font-black tracking-widest mb-2">
        {t('serviceDetail.latencyTrend')}
      </p>
      <div className={`flex items-center gap-2 font-black text-2xl tracking-tighter ${colorClass}`}>
        <Icon size={20} />
        {trend.slope_ms_per_check.toFixed(1)} ms/chk
      </div>
      {trend.is_degrading && trend.predicted_checks_to_breach != null && (
        <p className="text-[10px] text-orange-400/80 mt-2 font-medium">
          {t('serviceDetail.breachIn', { count: trend.predicted_checks_to_breach })}
        </p>
      )}
    </div>
  )
}
