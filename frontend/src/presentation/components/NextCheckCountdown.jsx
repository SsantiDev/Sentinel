import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'

function formatSeconds(totalSeconds) {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

export function NextCheckCountdown({ lastCheckedAt, checkIntervalSeconds, isActive }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!isActive) return null

  const dueAt = lastCheckedAt
    ? new Date(lastCheckedAt).getTime() + checkIntervalSeconds * 1000
    : now

  const remainingSeconds = Math.max(0, Math.round((dueAt - now) / 1000))

  return (
    <div className="flex items-center gap-1.5 text-text-secondary">
      <Timer size={12} />
      <span>{remainingSeconds === 0 ? 'Revisando...' : formatSeconds(remainingSeconds)}</span>
    </div>
  )
}
