import { useTranslation } from 'react-i18next'
import { ListModal } from './ListModal'

// Detalle de un contenedor clickeado (usuario o tipo de caso): lista sus
// anomalias y explica POR QUE cada una se marco (cuantas transacciones en la
// ventana superaron el umbral de su franja horaria).
const LEVEL_STYLES = {
  low: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  medium: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  high: 'bg-red-500/10 text-red-500 border-red-500/20',
}
const STATUS_STYLES = {
  open: 'bg-red-500/10 text-red-500 border-red-500/20',
  reviewed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  discarded: 'bg-slate-500/10 text-text-secondary border-border-subtle',
}
const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
})

export function AnomalyDetailModal({ open, title, subtitle, anomalies, onClose }) {
  const { t } = useTranslation()
  const rows = anomalies || []

  return (
    <ListModal open={open} title={title} subtitle={subtitle} onClose={onClose}>
      {rows.length === 0 ? (
        <p className="text-text-secondary text-xs">{t('anomalies.noData')}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="border border-border-subtle rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-bold text-text-primary truncate">{a.user}</span>
                <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${LEVEL_STYLES[a.level] || LEVEL_STYLES.low}`}>
                  {t(`anomalies.level.${a.level}`, a.level)}
                </span>
              </div>

              <p className="text-xs text-text-secondary tabular-nums">
                {a.transaction_count} tx · {a.window_seconds}s · {t('anomalies.thresholdLabel')} {a.threshold} · {t(`anomalies.band.${a.time_band}`, a.time_band)}
              </p>

              <div className="flex items-center justify-between gap-3 mt-3">
                <span className="text-[11px] font-bold text-text-primary tabular-nums">
                  {currency.format(a.total_value || 0)}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${STATUS_STYLES[a.status] || STATUS_STYLES.open}`}>
                    {t(`anomalies.status.${a.status}`, a.status)}
                  </span>
                  <span className="text-[10px] text-text-secondary tabular-nums">
                    {new Date(a.detected_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ListModal>
  )
}
