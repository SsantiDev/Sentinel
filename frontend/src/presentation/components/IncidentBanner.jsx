import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function formatElapsed(startedAt, t) {
  const diffMs = Date.now() - new Date(startedAt).getTime()
  const minutes = Math.max(1, Math.round(diffMs / 60000))
  if (minutes < 60) return t('serviceDetail.minutesAgo', { count: minutes })
  const hours = Math.round(minutes / 60)
  return t('serviceDetail.hoursAgo', { count: hours })
}

export function IncidentBanner({ incident }) {
  const { t } = useTranslation()
  if (!incident?.active_incident) return null

  return (
    <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4">
      <AlertTriangle className="text-red-400 shrink-0" size={20} />
      <div>
        <p className="text-red-400 font-black text-sm">{t('serviceDetail.incidentActive')}</p>
        <p className="text-text-secondary text-xs mt-0.5">
          {t('serviceDetail.incidentSince', { time: formatElapsed(incident.started_at, t) })}
        </p>
      </div>
    </div>
  )
}
