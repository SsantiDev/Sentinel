import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { cn } from '../../infrastructure/utils'
import { useLogs } from '../../application/hooks/useLogs'

const LEVEL_FILTERS = ['', 'INFO', 'WARNING', 'ERROR']

function lineColor(line) {
  if (line.includes(' ERROR ')) return 'text-red-400'
  if (line.includes(' WARNING ')) return 'text-amber-400'
  if (line.includes(' INFO ')) return 'text-text-primary'
  return 'text-text-secondary'
}

export function LogsPage() {
  const { t } = useTranslation()
  const { entries, level, setLevel, loading, error, auto, setAuto, refresh } = useLogs()

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 p-1 bg-bg-card border border-border-subtle rounded-2xl">
          {LEVEL_FILTERS.map((lvl) => (
            <button
              key={lvl || 'all'}
              onClick={() => setLevel(lvl)}
              className={cn(
                'px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors',
                level === lvl ? 'bg-[#2ecc71]/10 text-[#2ecc71]' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {lvl || t('logs.all')}
            </button>
          ))}
        </div>

        <button
          onClick={() => setAuto((v) => !v)}
          className={cn(
            'px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-colors',
            auto
              ? 'border-[#2ecc71]/30 text-[#2ecc71] bg-[#2ecc71]/10'
              : 'border-border-subtle text-text-secondary hover:text-text-primary'
          )}
        >
          {t('logs.auto')}
        </button>

        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {t('logs.refresh')}
        </button>
      </div>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-400">{error}</div>
      ) : (
        <div className="bg-bg-card border border-border-subtle rounded-2xl p-4 font-mono text-xs leading-relaxed max-h-[72vh] overflow-auto">
          {entries.length === 0 ? (
            <p className="text-text-secondary p-4">{t('logs.empty')}</p>
          ) : (
            entries.map((line, i) => (
              <div key={i} className={cn('whitespace-pre-wrap break-all py-0.5', lineColor(line))}>
                {line}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
