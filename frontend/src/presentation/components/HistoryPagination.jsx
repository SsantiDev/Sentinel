import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function pageWindow(page, totalPages) {
  return Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    if (totalPages <= 5 || page <= 3) return i + 1
    if (page >= totalPages - 2) return totalPages - 4 + i
    return page - 2 + i
  })
}

export function HistoryPagination({ page, totalPages, from, to, total, setPage }) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle">
      <span className="text-xs text-text-secondary tabular-nums">
        {t('history.showing')} {from}–{to} {t('history.of')} {total} {t('history.totalRecords')}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage(1)}
          disabled={page === 1}
          className="px-2 py-1 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          «
        </button>
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        {pageWindow(page, totalPages).map(pageNum => (
          <button
            key={pageNum}
            onClick={() => setPage(pageNum)}
            className={`w-8 h-8 rounded-lg text-xs transition-colors ${
              pageNum === page
                ? 'bg-[#2ecc71] text-black font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            {pageNum}
          </button>
        ))}
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setPage(totalPages)}
          disabled={page === totalPages}
          className="px-2 py-1 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          »
        </button>
      </div>
    </div>
  )
}
