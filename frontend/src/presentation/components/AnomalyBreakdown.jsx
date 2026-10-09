import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListModal } from './ListModal'
import { AnomalyDetailModal } from './AnomalyDetailModal'

const LEVEL_COLORS = {
  low: 'bg-amber-500',
  medium: 'bg-orange-500',
  high: 'bg-red-500',
}
const VISIBLE = 5

// Fila de metodo de pago. Clickeable: abre el desglose completo de metodos.
function MethodRow({ method, count, total, onClick }) {
  const percent = total > 0 ? (count / total) * 100 : 0
  return (
    <button
      onClick={onClick}
      className="w-full text-left cursor-pointer rounded-lg -mx-2 px-2 py-1 hover:bg-border-subtle/20 transition-colors"
    >
      <div className="flex justify-between text-xs font-bold text-text-secondary mb-1">
        <span className="truncate">{method}</span>
        <span className="tabular-nums shrink-0">{count}</span>
      </div>
      <div className="w-full h-2 bg-border-subtle rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${percent}%` }} />
      </div>
    </button>
  )
}

export function AnomalyBreakdown({ stats, anomalies }) {
  const { t } = useTranslation()
  const [methodsOpen, setMethodsOpen] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState(null)

  const levels = ['high', 'medium', 'low']
  const byLevel = stats.anomalies_by_level || { low: 0, medium: 0, high: 0 }
  const totalLevel = levels.reduce((sum, l) => sum + (byLevel[l] || 0), 0)

  const methods = stats.payment_method_distribution || []
  const totalMethods = methods.reduce((sum, m) => sum + m.count, 0)
  const visibleMethods = methods.slice(0, VISIBLE)

  const openLevel = (level) => {
    const items = (anomalies || []).filter((a) => a.level === level)
    setSelectedLevel({ level, items })
  }

  const renderMethods = (items) => (
    <div className="space-y-4">
      {items.map((m) => (
        <MethodRow key={m.method} method={m.method} count={m.count} total={totalMethods} onClick={() => setMethodsOpen(true)} />
      ))}
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div className="bg-bg-card border border-border-subtle rounded-3xl p-6">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-widest mb-5">
          {t('anomalies.byLevel')}
        </h3>
        <div className="space-y-4">
          {levels.map((level) => {
            const count = byLevel[level] || 0
            const percent = totalLevel > 0 ? (count / totalLevel) * 100 : 0
            return (
              <button
                key={level}
                onClick={() => openLevel(level)}
                className="w-full text-left cursor-pointer rounded-lg -mx-2 px-2 py-1 hover:bg-border-subtle/20 transition-colors"
              >
                <div className="flex justify-between text-xs font-bold text-text-secondary mb-1">
                  <span>{t(`anomalies.level.${level}`)}</span>
                  <span className="tabular-nums">{count}</span>
                </div>
                <div className="w-full h-2 bg-border-subtle rounded-full overflow-hidden">
                  <div
                    className={`h-full ${LEVEL_COLORS[level]} rounded-full transition-all`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-bg-card border border-border-subtle rounded-3xl p-6">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-widest mb-5">
          {t('anomalies.paymentMethods')}
        </h3>
        {methods.length === 0 ? (
          <p className="text-text-secondary text-xs">{t('anomalies.noData')}</p>
        ) : (
          <>
            {renderMethods(visibleMethods)}
            {methods.length > VISIBLE && (
              <button
                onClick={() => setMethodsOpen(true)}
                className="mt-5 w-full text-[11px] font-black uppercase tracking-widest text-text-secondary hover:text-text-primary border border-border-subtle rounded-xl py-2.5 transition-colors cursor-pointer"
              >
                {t('anomalies.verMas', { count: methods.length })}
              </button>
            )}
            <ListModal open={methodsOpen} title={t('anomalies.paymentMethods')} onClose={() => setMethodsOpen(false)}>
              {renderMethods(methods)}
            </ListModal>
          </>
        )}
      </div>

      <AnomalyDetailModal
        open={selectedLevel !== null}
        title={selectedLevel ? t(`anomalies.level.${selectedLevel.level}`) : ''}
        subtitle={selectedLevel ? `${selectedLevel.items.length} ${t('anomalies.anomalyCountSuffix')}` : ''}
        anomalies={selectedLevel?.items || []}
        onClose={() => setSelectedLevel(null)}
      />
    </div>
  )
}
