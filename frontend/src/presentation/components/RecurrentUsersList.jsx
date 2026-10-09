import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListModal } from './ListModal'
import { AnomalyDetailModal } from './AnomalyDetailModal'

const VISIBLE = 5

// Usuarios recurrentes: los que acumulan mas anomalias. Cada fila es clickeable
// y abre el detalle de las anomalias de ese usuario (por que se marcaron).
function UserRow({ user, index, max, suffix, onClick }) {
  return (
    <li>
      <button onClick={onClick} className="w-full flex items-center gap-4 text-left group cursor-pointer rounded-lg -mx-2 px-2 py-1 hover:bg-border-subtle/20 transition-colors">
        <span className="text-xs font-black text-text-secondary tabular-nums w-5 shrink-0">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-bold text-text-primary truncate group-hover:text-[#2ecc71] transition-colors">
              {user.user}
            </span>
            <span className="text-xs font-black text-text-primary tabular-nums shrink-0">
              {user.anomaly_count} <span className="text-text-secondary font-medium lowercase">{suffix}</span>
            </span>
          </div>
          <div className="w-full h-1.5 bg-border-subtle rounded-full overflow-hidden mt-2">
            <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${(user.anomaly_count / max) * 100}%` }} />
          </div>
        </div>
      </button>
    </li>
  )
}

export function RecurrentUsersList({ users, anomalies }) {
  const { t } = useTranslation()
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState(null)

  const rows = users || []
  const max = rows.reduce((m, u) => Math.max(m, u.anomaly_count), 0) || 1
  const suffix = t('anomalies.anomalyCountSuffix')
  const detail = selected ? (anomalies || []).filter((a) => a.user === selected) : []

  const renderList = (items) => (
    <ol className="space-y-4">
      {items.map((u, i) => (
        <UserRow key={u.user} user={u} index={i} max={max} suffix={suffix} onClick={() => setSelected(u.user)} />
      ))}
    </ol>
  )

  return (
    <div className="bg-bg-card border border-border-subtle rounded-3xl p-6">
      <h3 className="text-sm font-black text-text-primary uppercase tracking-widest mb-5">
        {t('anomalies.recurrentUsers')}
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
          <ListModal open={showAll} title={t('anomalies.recurrentUsers')} subtitle={t('anomalies.verMas', { count: rows.length })} onClose={() => setShowAll(false)}>
            {renderList(rows)}
          </ListModal>
          <AnomalyDetailModal
            open={selected !== null}
            title={selected || ''}
            subtitle={`${detail.length} ${suffix}`}
            anomalies={detail}
            onClose={() => setSelected(null)}
          />
        </>
      )}
    </div>
  )
}
