import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'

const STATUS_STYLES = {
  open: 'bg-red-500/10 text-red-500 border-red-500/20',
  reviewed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  discarded: 'bg-gray-500/10 text-text-secondary border-border-subtle',
}

const LEVEL_STYLES = {
  low: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  medium: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  high: 'bg-red-500/10 text-red-500 border-red-500/20',
}

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
})

export function AnomalyTable({ anomalies, onUpdateStatus, onSelectAnomaly }) {
  const { t } = useTranslation()

  if (anomalies.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center justify-center bg-bg-card/50 rounded-3xl border-2 border-dashed border-border-subtle">
        <Clock size={40} className="text-text-secondary mb-3 opacity-20" />
        <p className="text-text-secondary font-bold">{t('anomalies.noAnomalies')}</p>
      </div>
    )
  }

  return (
    <div className="bg-bg-card border border-border-subtle rounded-3xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-left text-[10px] uppercase tracking-widest text-text-secondary">
            <th className="px-6 py-4 font-black">{t('anomalies.table.user')}</th>
            <th className="px-6 py-4 font-black">{t('anomalies.table.transactionCount')}</th>
            <th className="px-6 py-4 font-black">{t('anomalies.table.window')}</th>
            <th className="px-6 py-4 font-black">{t('anomalies.table.value')}</th>
            <th className="px-6 py-4 font-black">{t('anomalies.table.level')}</th>
            <th className="px-6 py-4 font-black">{t('anomalies.table.status')}</th>
            <th className="px-6 py-4 font-black">{t('anomalies.table.detectedAt')}</th>
            <th className="px-6 py-4 font-black">{t('anomalies.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {anomalies.map((a) => (
            <tr
              key={a.id}
              onClick={() => onSelectAnomaly(a)}
              className="border-b border-border-subtle last:border-0 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
            >
              <td className="px-6 py-4 font-bold text-text-primary">{a.user}</td>
              <td className="px-6 py-4 text-text-secondary">{a.transaction_count}</td>
              <td className="px-6 py-4 text-text-secondary">{a.window_seconds}s</td>
              <td className="px-6 py-4 text-text-secondary">{currency.format(a.total_value || 0)}</td>
              <td className="px-6 py-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${LEVEL_STYLES[a.level] || LEVEL_STYLES.low}`}>
                  {t(`anomalies.level.${a.level}`)}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_STYLES[a.status]}`}>
                  {t(`anomalies.status.${a.status}`)}
                </span>
              </td>
              <td className="px-6 py-4 text-text-secondary text-xs">
                {new Date(a.detected_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td className="px-6 py-4">
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {a.status !== 'reviewed' && (
                    <button
                      onClick={() => onUpdateStatus(a.id, 'reviewed')}
                      title={t('anomalies.markReviewed')}
                      className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                  {a.status !== 'discarded' && (
                    <button
                      onClick={() => onUpdateStatus(a.id, 'discarded')}
                      title={t('anomalies.markDiscarded')}
                      className="p-2 rounded-lg text-text-secondary hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <XCircle size={16} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
