import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function AnomalyTimelineModal({ data, loading, onClose }) {
  const { t } = useTranslation()
  const isOpen = data !== null || loading

  const windowSeconds = data?.window_seconds ?? 0
  const detectedAt = data ? new Date(data.anomaly.detected_at) : null
  const windowStart = detectedAt ? new Date(detectedAt.getTime() - windowSeconds * 1000) : null

  const points = data?.events_in_window.map((e) => {
    const occurredAt = new Date(e.occurred_at)
    const offsetSeconds = (occurredAt - windowStart) / 1000
    const percent = windowSeconds > 0 ? Math.min(100, Math.max(0, (offsetSeconds / windowSeconds) * 100)) : 0
    return { ...e, occurredAt, percent }
  }) ?? []

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 350 }}
            className="relative w-full max-w-[560px] z-10"
          >
            <div className="bg-bg-card border border-border-subtle rounded-[2.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.3)] relative p-10">
              <button
                onClick={onClose}
                className="absolute top-5 right-6 z-20 text-text-secondary hover:text-text-primary transition-all p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-2">
                <Zap className="text-orange-500" size={22} />
                <h3 className="text-text-primary text-xl font-black tracking-tight">
                  {t('anomalies.timeline.title')}
                </h3>
              </div>

              {loading && !data ? (
                <p className="text-text-secondary text-sm mt-6">...</p>
              ) : data && (
                <>
                  <p className="text-text-secondary text-sm mb-8">
                    {t('anomalies.timeline.windowSeconds', { seconds: windowSeconds })} — {data.anomaly.event_count} {t('anomalies.table.eventCount').toLowerCase()}
                  </p>

                  <div className="relative h-16 mb-4">
                    <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-border-subtle rounded-full" />
                    {points.map((p, idx) => (
                      <div
                        key={idx}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
                        style={{ left: `${p.percent}%` }}
                      >
                        <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-bg-card shadow-lg shadow-red-500/40" />
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap bg-[#1a1a2e] text-white text-[10px] px-2 py-1 rounded-lg">
                          {p.occurredAt.toLocaleTimeString([], { hour12: false })} — {p.event_type}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between text-[10px] text-text-secondary font-medium uppercase tracking-wider">
                    <span>{windowStart?.toLocaleTimeString([], { hour12: false })}</span>
                    <span className="text-red-500">{t('anomalies.timeline.inWindow')}</span>
                    <span>{detectedAt?.toLocaleTimeString([], { hour12: false })}</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
