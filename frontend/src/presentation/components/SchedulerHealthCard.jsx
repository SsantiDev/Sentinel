import { Activity, AlertTriangle } from 'lucide-react'
import { cn } from '../../infrastructure/utils'

const HEALTHY_THRESHOLD_SECONDS = 90 // si corrio hace mas de esto, se considera "no sano"

function formatSecondsAgo(seconds) {
  if (seconds < 60) return `hace ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `hace ${minutes}m`
}

export function SchedulerHealthCard({ status, loading }) {
  if (loading || !status) {
    return (
      <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 animate-pulse h-24" />
    )
  }

  const neverRan = status.last_run_at === null
  const seconds = Math.round(status.seconds_since_last_run ?? 0)
  const isHealthy = !neverRan && seconds <= HEALTHY_THRESHOLD_SECONDS

  return (
    <div className={cn(
      "bg-bg-card border rounded-2xl p-6 flex items-center justify-between",
      isHealthy ? "border-[#2ecc71]/30" : "border-red-500/30"
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-11 h-11 rounded-2xl flex items-center justify-center",
          isHealthy ? "bg-[#2ecc71]/10 text-[#2ecc71]" : "bg-red-500/10 text-red-400"
        )}>
          {isHealthy ? <Activity size={20} /> : <AlertTriangle size={20} />}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">
            Estado del Turnero
          </p>
          <p className="text-sm font-bold text-text-primary mt-0.5">
            {neverRan ? 'Sin corridas registradas' : `Ultimo tick: ${formatSecondsAgo(seconds)}`}
          </p>
        </div>
      </div>
      {!neverRan && (
        <div className="text-right">
          <p className="text-lg font-black text-text-primary">
            {status.queued_count}/{status.total_scheduled}
          </p>
          <p className="text-[10px] text-text-secondary uppercase tracking-wider">encolados</p>
        </div>
      )}
    </div>
  )
}
