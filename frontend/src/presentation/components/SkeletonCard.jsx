export function SkeletonCard() {
  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl p-6 h-[180px] animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-[#2a2a3e] rounded w-3/4"></div>
          <div className="h-3 bg-[#2a2a3e] rounded w-1/2 opacity-50"></div>
        </div>
        <div className="w-16 h-6 bg-[#2a2a3e] rounded-full"></div>
      </div>
      <div className="mt-6 flex gap-1">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="flex-1 h-4 bg-[#2a2a3e] rounded-sm opacity-30"></div>
        ))}
      </div>
      <div className="mt-auto pt-6 flex justify-between">
        <div className="h-3 bg-[#2a2a3e] rounded w-16"></div>
        <div className="h-3 bg-[#2a2a3e] rounded w-24"></div>
      </div>
    </div>
  )
}

export function SkeletonSummary() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-32 bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl animate-pulse"></div>
      ))}
    </div>
  )
}
