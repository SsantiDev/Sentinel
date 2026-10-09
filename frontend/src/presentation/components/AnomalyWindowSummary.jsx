import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnomalyDetailModal } from './AnomalyDetailModal'

const nf = new Intl.NumberFormat('es-CO')
const DAY_MS = 24 * 60 * 60 * 1000

// Inicio de la ventana para filtrar anomalias igual que el backend:
// hoy = desde medianoche; semana = ultimos 7 dias; mes = ultimos 30.
function windowCutoff(key) {
  const now = new Date()
  if (key === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start
  }
  const days = key === 'week' ? 7 : 30
  return new Date(now.getTime() - days * DAY_MS)
}

// Resumen por periodo: Hoy / Esta semana / Este mes, con el volumen de
// transacciones y el numero de anomalias detectadas en cada ventana. Cada
// tarjeta abre el listado de anomalias de esa ventana.
export function AnomalyWindowSummary({ stats, anomalies }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(null)

  const windows = [
    { key: 'today', txns: stats.transactions_today, anomalies: stats.anomalies_today },
    { key: 'week', txns: stats.transactions_this_week, anomalies: stats.anomalies_this_week },
    { key: 'month', txns: stats.transactions_this_month, anomalies: stats.anomalies_this_month },
  ]

  const openWindow = (key) => {
    const cutoff = windowCutoff(key)
    const items = (anomalies || []).filter(
      (a) => a.detected_at && new Date(a.detected_at) >= cutoff
    )
    setSelected({ key, items })
  }

  return (
    <div className="bg-bg-card border border-border-subtle rounded-3xl overflow-hidden mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border-subtle">
        {windows.map((w) => (
          <button
            key={w.key}
            onClick={() => openWindow(w.key)}
            className="p-6 text-left w-full cursor-pointer hover:bg-border-subtle/20 transition-colors"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
              {t(`anomalies.window.${w.key}`)}
            </span>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-black text-text-primary tracking-tighter tabular-nums">
                  {nf.format(w.txns)}
                </p>
                <p className="text-[10px] text-text-secondary mt-1 font-medium uppercase tracking-wider">
                  {t('anomalies.metricTransactions')}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-xl font-black tabular-nums ${w.anomalies > 0 ? 'text-red-500' : 'text-text-secondary'}`}>
                  {nf.format(w.anomalies)}
                </p>
                <p className="text-[10px] text-text-secondary mt-1 font-medium uppercase tracking-wider">
                  {t('anomalies.metricAnomalies')}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <AnomalyDetailModal
        open={selected !== null}
        title={selected ? t(`anomalies.window.${selected.key}`) : ''}
        subtitle={selected ? `${selected.items.length} ${t('anomalies.metricAnomalies').toLowerCase()}` : ''}
        anomalies={selected?.items || []}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
