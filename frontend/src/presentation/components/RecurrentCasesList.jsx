import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListModal } from './ListModal'
import { AnomalyDetailModal } from './AnomalyDetailModal'

const VISIBLE = 5

// Casos mas recurrentes: combinaciones de franja horaria + nivel que mas se
// repiten. Cada fila es clickeable y abre las anomalias de ese tipo de caso.
const LEVEL_COLOR = { low: 'bg-amber-500', medium: 'bg-orange-500', high: 'bg-red-500' }
const LEVEL_TEXT = { low: 'text-amber-500', medium: 'text-orange-500', high: 'text-red-500' }

function CaseRow({ item, max, t, onClick }) {
  const color = LEVEL_COLOR[item.level] || LEVEL_COLOR.low
  return (
    <li>
      <button onClick={onClick} className="w-full flex items-center gap-4 text-left group cursor-pointer rounded-lg -mx-2 px-2 py-1 hover:bg-border-subtle/20 transition-colors">
        <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-bold text-text-primary truncate group-hover:text-[#2ecc71] transition-colors">
              {t(`anomalies.band.${item.time_band}`, item.time_band)}
              <span className="text-text-secondary"> · </span>
              <span className={LEVEL_TEXT[item.level] || LEVEL_TEXT.low}>
                {t(`anomalies.level.${item.level}`, item.level)}
              </span>
            </span>
            <span className="text-xs font-black text-text-primary tabular-nums shrink-0">{item.count}</span>
          </div>
          <div className="w-full h-1.5 bg-border-subtle rounded-full overflow-hidden mt-2">
            <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </div>
      </button>
    </li>
  )
}

export function RecurrentCasesList({ cases, anomalies }) {
  const { t } = useTranslation()
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState(null)

  const rows = cases || []
  const max = rows.reduce((m, c) => Math.max(m, c.count), 0) || 1
  const detail = selected
    ? (anomalies || []).filter((a) => a.time_band === selected.time_band && a.level === selected.level)
    : []
  const detailTitle = selected
    ? `${t(`anomalies.band.${selected.time_band}`, selected.time_band)} · ${t(`anomalies.level.${selected.level}`, selected.level)}`
    : ''

  const renderList = (items) => (
    <ul className="space-y-4">
      {items.map((c, i) => (
        <CaseRow key={`${c.time_band}-${c.level}-${i}`} item={c} max={max} t={t} onClick={() => setSelected(c)} />
      ))}
    </ul>
  )

  return (
    <div className="bg-bg-card border border-border-subtle rounded-3xl p-6">
      <h3 className="text-sm font-black text-text-primary uppercase tracking-widest mb-5">
        {t('anomalies.recurrentCases')}
      </h3>

      {rows.length === 0 ? (
        <p className="text-text-secondary text-xs">{t('anomalies.noData')}</p>
      ) : (
        <>
          {renderList(rows.slice(0, VISIBLE))}
          {rows.length > VISIBLE && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-5 w-full text-[11px] font-black uppercase tracking-widest text-text-secondary hover:text-text-primary border border-border-subtle hover:border-text-secondary/30 rounded-xl py-2.5 transition-colors"
            >
              {t('anomalies.verMas', { count: rows.length })}
            </button>
          )}
          <ListModal open={showAll} title={t('anomalies.recurrentCases')} subtitle={t('anomalies.verMas', { count: rows.length })} onClose={() => setShowAll(false)}>
            {renderList(rows)}
          </ListModal>
          <AnomalyDetailModal
            open={selected !== null}
            title={detailTitle}
            subtitle={`${detail.length} ${t('anomalies.anomalyCountSuffix')}`}
            anomalies={detail}
            onClose={() => setSelected(null)}
          />
        </>
      )}
    </div>
  )
}
