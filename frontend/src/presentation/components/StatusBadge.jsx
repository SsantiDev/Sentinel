import { cn } from '../../infrastructure/utils'

export function StatusBadge({ status }) {
  const isUp = status === 'up'
  const isDown = status === 'down'

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border",
      isUp ? "bg-green-500/10 text-green-400 border-green-500/20" : 
      isDown ? "bg-red-500/10 text-red-400 border-red-500/20" : 
      "bg-gray-500/10 text-gray-400 border-gray-500/20"
    )}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(currentcolor,0.5)]",
        isUp ? "bg-green-400 animate-pulse" : 
        isDown ? "bg-red-400" : 
        "bg-gray-400"
      )} />
      {status?.toUpperCase() || 'UNKNOWN'}
    </span>
  )
}
