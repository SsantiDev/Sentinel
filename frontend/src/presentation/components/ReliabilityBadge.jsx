import { cn } from '../../infrastructure/utils'

const TIER_STYLES = {
  Platinum: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Gold: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Silver: 'bg-slate-400/10 text-slate-300 border-slate-400/20',
  Bronze: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Unranked: 'bg-gray-500/10 text-text-secondary border-border-subtle',
}

export function ReliabilityBadge({ tier }) {
  if (!tier) return null

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border',
      TIER_STYLES[tier] || TIER_STYLES.Unranked
    )}>
      {tier}
    </span>
  )
}
