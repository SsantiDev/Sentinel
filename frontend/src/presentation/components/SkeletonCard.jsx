import './Skeleton.css';

export function SkeletonCard() {
  return (
    <div className="skeleton-card skeleton-pulse">
      <div className="flex justify-between mb-4">
        <div className="space-y-2 flex-1">
          <div className="h-4 skeleton-item w-3/4"></div>
          <div className="h-3 skeleton-item w-1/2 opacity-50"></div>
        </div>
        <div className="w-16 h-6 skeleton-item rounded-full"></div>
      </div>
      <div className="mt-6 flex gap-1">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="flex-1 h-4 skeleton-item opacity-30"></div>
        ))}
      </div>
      <div className="mt-auto pt-6 flex justify-between">
        <div className="h-3 skeleton-item w-16"></div>
        <div className="h-3 skeleton-item w-24"></div>
      </div>
    </div>
  )
}

export function SkeletonSummary() {
  return (
    <div className="skeleton-summary-grid mb-10">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton-summary-item skeleton-pulse"></div>
      ))}
    </div>
  )
}
