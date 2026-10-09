import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnomalyDetailModal } from './AnomalyDetailModal'

// Mapa de calor de anomalias por hora (0-23). La intensidad del color
// representa la cantidad de anomalias de esa hora: a mas anomalias, mas
// intenso. Cada hora es clickeable y abre las anomalias de esa hora.
//
// El conteo por hora se calcula aqui desde la MISMA lista de anomalias que usa
// el detalle (y en hora LOCAL, igual que la linea de tiempo), para que el color,
// el click y el modal siempre coincidan sin desajustes de zona horaria.
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const ACCENT_RGB = '249, 156, 18' // #f39c12 (naranja de acento)
const MIN_OPACITY = 0.2 // piso: una hora con pocas anomalias sigue visible

const pad = (hour) => String(hour).padStart(2, '0')
const anomalyHour = (a) => new Date(a.window_end).getHours()

function cellStyle(count, max) {
  if (count === 0) return undefined
  const ratio = max > 0 ? count / max : 0
  const opacity = MIN_OPACITY + ratio * (1 - MIN_OPACITY)
  return { backgroundColor: `rgba(${ACCENT_RGB}, ${opacity})` }
}

export function AnomalyHourlyHeatmap({ anomalies }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(null)

  const valid = (anomalies || []).filter((a) => a.window_end)
  const byHour = new Map()
  valid.forEach((a) => {
    const h = anomalyHour(a)
    byHour.set(h, (byHour.get(h) || 0) + 1)
  })
  const max = Math.max(0, ...byHour.values())

  const openHour = (hour) => {
    const items = valid.filter((a) => anomalyHour(a) === hour)
    setSelected({ hour, items })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-12 gap-x-1.5 gap-y-2 flex-1 content-center">
        {HOURS.map((hour) => {
          const count = byHour.get(hour) || 0
          return (
            <button
              key={hour}
              onClick={() => openHour(hour)}
              className="flex flex-col items-center gap-1 rounded-md hover:opacity-80 transition-opacity"
              title={`${pad(hour)}:00 · ${count}`}
            >
              <div
                className="w-full aspect-square rounded-md bg-border-subtle/50"
                style={cellStyle(count, max)}
              />
              <span className="text-[8px] text-text-secondary tabular-nums leading-none">
                {pad(hour)}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-text-secondary mt-3 font-medium">
        {t('anomalies.hourlyHeatmapHint')}
      </p>

      <AnomalyDetailModal
        open={selected !== null}
        title={selected ? `${pad(selected.hour)}:00` : ''}
        subtitle={selected ? `${selected.items.length} ${t('anomalies.anomalyCountSuffix')}` : ''}
        anomalies={selected?.items || []}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
