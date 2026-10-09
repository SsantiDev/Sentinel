import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnomalyDetailModal } from './AnomalyDetailModal'

// Estado de revision de las anomalias: abiertas (nuevas), revisadas y
// descartadas. Una barra segmentada muestra la proporcion de cada estado y
// cada estado abre el listado de sus anomalias.
const SEGMENTS = [
  { key: 'open', field: 'anomalies_open', labelKey: 'anomalies.openLabel', bar: 'bg-red-500', text: 'text-red-500' },
  { key: 'reviewed', field: 'anomalies_reviewed', labelKey: 'anomalies.reviewedLabel', bar: 'bg-emerald-500', text: 'text-emerald-500' },
  { key: 'discarded', field: 'anomalies_discarded', labelKey: 'anomalies.discardedLabel', bar: 'bg-slate-400', text: 'text-text-secondary' },
]

export function AnomalyStatusStrip({ stats, anomalies }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(null)

  const counts = SEGMENTS.map((s) => ({ ...s, value: stats[s.field] || 0 }))
  const total = counts.reduce((sum, s) => sum + s.value, 0)

  const openStatus = (segment) => {
    const items = (anomalies || []).filter((a) => a.status === segment.key)
    setSelected({ key: segment.key, labelKey: segment.labelKey, items })
  }

  return (
    <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-widest">
          {t('anomalies.reviewStatus')}
        </h3>
        <span className="text-xs font-bold text-text-secondary tabular-nums">{total}</span>
      </div>

      <div className="w-full h-3 rounded-full overflow-hidden flex bg-border-subtle">
        {total > 0 &&
          counts.map((s) =>
            s.value > 0 ? (
              <div key={s.key} className={`${s.bar} h-full`} style={{ width: `${(s.value / total) * 100}%` }} />
            ) : null
          )}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-5">
        {counts.map((s) => (
          <button
            key={s.key}
            onClick={() => openStatus(s)}
            className="text-left cursor-pointer rounded-xl -m-2 p-2 hover:bg-border-subtle/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.bar}`} />
              <span className="text-[10px] font-black uppercase tracking-wider text-text-secondary">
                {t(s.labelKey)}
              </span>
            </div>
            <p className={`text-2xl font-black tabular-nums mt-1 ${s.text}`}>{s.value}</p>
          </button>
        ))}
      </div>

      <AnomalyDetailModal
        open={selected !== null}
        title={selected ? t(selected.labelKey) : ''}
        subtitle={selected ? `${selected.items.length} ${t('anomalies.anomalyCountSuffix')}` : ''}
        anomalies={selected?.items || []}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
