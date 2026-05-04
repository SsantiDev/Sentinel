import { useMemo } from 'react'

export function StatusTimeline({ history = [], limit = 30 }) {
  const blocks = useMemo(() => {
    // Reverse because history comes latest first, and we want to show left-to-right (past-to-present)
    const sortedHistory = [...history].reverse().slice(-limit)
    
    // Fill with empty if less than limit
    const padding = limit - sortedHistory.length
    const paddedHistory = [
      ...Array(padding).fill({ status: 'none' }),
      ...sortedHistory
    ]

    return paddedHistory
  }, [history, limit])

  return (
    <div className="flex gap-1 items-center w-full">
      {blocks.map((check, i) => {
        let colorClass = 'bg-border-subtle/40' // None / Unknown
        
        if (check.status === 'up') {
          colorClass = check.response_time_ms > 500 ? 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.3)]' : 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.3)]'
        } else if (check.status === 'down') {
          colorClass = 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]'
        }

        const title = check.status !== 'none' 
          ? `${new Date(check.checked_at).toLocaleString()} - ${check.status.toUpperCase()} (${Math.round(check.response_time_ms || 0)}ms)`
          : 'Sin datos'

        return (
          <div
            key={i}
            title={title}
            className={`flex-1 h-8 rounded-[2px] border border-white/5 ${colorClass} transition-all hover:scale-y-125 cursor-help`}
          />
        )
      })}
    </div>
  )
}
