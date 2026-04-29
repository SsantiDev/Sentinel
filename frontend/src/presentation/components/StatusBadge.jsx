export function StatusBadge({ status }) {
  const styles = {
    up: 'bg-green-500/20 text-green-400 border border-green-500/30',
    down: 'bg-red-500/20 text-red-400 border border-red-500/30',
    unknown: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  }
  const labels = { up: '● UP', down: '● DOWN', unknown: '● UNKNOWN' }
  const s = status || 'unknown'
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded-full ${styles[s] || styles.unknown}`}>
      {labels[s] || labels.unknown}
    </span>
  )
}
