import { useTranslation } from 'react-i18next'
import { cn } from '../../infrastructure/utils'

// Orden fijo de los motivos en la barra de filtros.
const REASONS = ['all', 'burst', 'invalid_data', 'duplicate_id', 'invalid_signature']

// Barra de filtros por motivo de anomalia (con contador). Separa de un vistazo
// las anomalias por ventana (rafaga) de las de dato invalido, firma o ID
// repetido, y al tocar un motivo la tabla muestra solo ese tipo.
export function AnomalyReasonTabs({ anomalies, value, onChange }) {
  const { t } = useTranslation()

  const counts = anomalies.reduce((acc, a) => {
    const reason = a.reason || 'burst'
    acc[reason] = (acc[reason] || 0) + 1
    return acc
  }, {})

  // Solo se muestra un motivo si hay anomalias de ese tipo ('all' siempre).
  const visible = REASONS.filter((r) => r === 'all' || counts[r] > 0)

  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {visible.map((reason) => {
        const count = reason === 'all' ? anomalies.length : (counts[reason] || 0)
        const active = value === reason
        return (
          <button
            key={reason}
            onClick={() => onChange(reason)}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-colors',
              active
                ? 'bg-[#2ecc71]/10 text-[#2ecc71] border-[#2ecc71]/30'
                : 'text-text-secondary border-border-subtle hover:text-text-primary'
            )}
          >
            {reason === 'all' ? t('anomalies.filter.all') : t(`anomalies.reason.${reason}`)}
            <span className="ml-1.5 opacity-60 tabular-nums">({count})</span>
          </button>
        )
      })}
    </div>
  )
}
