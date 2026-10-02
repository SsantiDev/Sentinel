import { useTranslation } from 'react-i18next'

const LEVEL_COLORS = {
  low: 'bg-amber-500',
  medium: 'bg-orange-500',
  high: 'bg-red-500',
}

export function AnomalyBreakdown({ stats }) {
  const { t } = useTranslation()

  const levels = ['high', 'medium', 'low']
  const byLevel = stats.anomalies_by_level || { low: 0, medium: 0, high: 0 }
  const totalLevel = levels.reduce((sum, l) => sum + (byLevel[l] || 0), 0)

  const methods = stats.payment_method_distribution || []
  const totalMethods = methods.reduce((sum, m) => sum + m.count, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
      <div className="bg-bg-card border border-border-subtle rounded-3xl p-6">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-widest mb-5">
          {t('anomalies.byLevel')}
        </h3>
        <div className="space-y-4">
          {levels.map((level) => {
            const count = byLevel[level] || 0
            const percent = totalLevel > 0 ? (count / totalLevel) * 100 : 0
            return (
              <div key={level}>
                <div className="flex justify-between text-xs font-bold text-text-secondary mb-1">
                  <span>{t(`anomalies.level.${level}`)}</span>
                  <span>{count}</span>
                </div>
                <div className="w-full h-2 bg-border-subtle rounded-full overflow-hidden">
                  <div
                    className={`h-full ${LEVEL_COLORS[level]} rounded-full transition-all`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-bg-card border border-border-subtle rounded-3xl p-6">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-widest mb-5">
          {t('anomalies.paymentMethods')}
        </h3>
        {methods.length === 0 ? (
          <p className="text-text-secondary text-xs">—</p>
        ) : (
          <div className="space-y-4">
            {methods.map((m) => {
              const percent = totalMethods > 0 ? (m.count / totalMethods) * 100 : 0
              return (
                <div key={m.method}>
                  <div className="flex justify-between text-xs font-bold text-text-secondary mb-1">
                    <span>{m.method}</span>
                    <span>{m.count}</span>
                  </div>
                  <div className="w-full h-2 bg-border-subtle rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
