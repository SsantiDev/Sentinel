import { useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../infrastructure/utils'
import { isAdmin } from '../../infrastructure/authStorage'
import { useAnomalyDashboard } from '../../application/hooks/useAnomalyDashboard'
import { ConfirmModal } from '../components/ConfirmModal'
import { detectSpikes } from '../../application/analysis/detectSpikes'
import { AnomalyWindowSummary } from '../components/AnomalyWindowSummary'
import { AnomalyStatCards } from '../components/AnomalyStatCards'
import { MultipleTransactionsCard } from '../components/MultipleTransactionsCard'
import { AnomalyStatusStrip } from '../components/AnomalyStatusStrip'
import { RecurrentUsersList } from '../components/RecurrentUsersList'
import { RecurrentCasesList } from '../components/RecurrentCasesList'
import { DetectionConfigPanel } from '../components/DetectionConfigPanel'
import { AnomalyBreakdown } from '../components/AnomalyBreakdown'
import { AnomalyHourlyHeatmap } from '../components/AnomalyHourlyHeatmap'
import { AnomalyTrendChart } from '../components/AnomalyTrendChart'
import { AnomalyTable } from '../components/AnomalyTable'
import { AnomalyReasonTabs } from '../components/AnomalyReasonTabs'
import { AnomalyTimelineModal } from '../components/AnomalyTimelineModal'
import { SkeletonCard } from '../components/SkeletonCard'

const TABS = ['overview', 'analysis', 'anomalies']

export function AnomalyDashboardPage() {
  const { t } = useTranslation()
  const { stats, trends, anomalies, loading, error, updateStatus, fetchTimeline, resetData } = useAnomalyDashboard()
  const [tab, setTab] = useState('overview')
  const [timelineData, setTimelineData] = useState(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [reasonFilter, setReasonFilter] = useState('all')

  const handleSelectAnomaly = async (anomaly) => {
    setTimelineLoading(true)
    try {
      setTimelineData(await fetchTimeline(anomaly.id))
    } finally {
      setTimelineLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full">
        <div className="h-11 w-72 bg-border-subtle/60 rounded-2xl animate-pulse mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-400">
        {error}
      </div>
    )
  }

  const spikeDates = detectSpikes(
    (trends.daily_evolution || []).map((d) => ({ date: d.date, anomalies: d.anomaly_count }))
  )

  // Filtra por motivo (ráfaga, dato inválido, etc.) y por usuario (buscador).
  const normalizedQuery = query.trim().toLowerCase()
  const filteredAnomalies = anomalies.filter((a) => {
    const matchesReason = reasonFilter === 'all' || (a.reason || 'burst') === reasonFilter
    const matchesQuery = !normalizedQuery || (a.user || '').toLowerCase().includes(normalizedQuery)
    return matchesReason && matchesQuery
  })

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div className="flex gap-1 p-1 bg-bg-card border border-border-subtle rounded-2xl sm:inline-flex">
          {TABS.map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors',
                tab === key
                  ? 'bg-[#2ecc71]/10 text-[#2ecc71]'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {t(`anomalies.tab.${key}`)}
            </button>
          ))}
        </div>
        {isAdmin() && (
          <button
            onClick={() => setResetOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-red-500 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
            {t('anomalies.reset.button')}
          </button>
        )}
      </div>

      {tab === 'overview' && (
        <>
          <AnomalyWindowSummary stats={stats} anomalies={anomalies} />
          <AnomalyStatCards stats={stats} anomalies={anomalies} />
          <MultipleTransactionsCard stats={stats} />
          <AnomalyStatusStrip stats={stats} anomalies={anomalies} />
        </>
      )}

      {tab === 'analysis' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <RecurrentUsersList users={stats.top_recurrent_users} anomalies={anomalies} />
            <RecurrentCasesList cases={stats.top_recurrent_cases} anomalies={anomalies} />
          </div>
          <AnomalyBreakdown stats={stats} anomalies={anomalies} />
        </>
      )}

      {tab === 'anomalies' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 h-80">
              <h3 className="text-sm font-black text-text-primary uppercase tracking-widest mb-4">
                {t('anomalies.hourlyDistribution')}
              </h3>
              <div className="h-[calc(100%-2rem)]">
                <AnomalyHourlyHeatmap anomalies={anomalies} />
              </div>
            </div>
            <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 h-80">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-text-primary uppercase tracking-widest">
                  {t('anomalies.dailyEvolution')}
                </h3>
                <span className={`text-[10px] font-black uppercase tracking-wider tabular-nums ${spikeDates.size > 0 ? 'text-red-500' : 'text-text-secondary'}`}>
                  {spikeDates.size > 0
                    ? t('anomalies.spikesDetected', { count: spikeDates.size })
                    : t('anomalies.spikesNone')}
                </span>
              </div>
              <div className="h-[calc(100%-2rem)]">
                <AnomalyTrendChart dailyEvolution={trends.daily_evolution} spikeDates={spikeDates} />
              </div>
            </div>
          </div>

          <DetectionConfigPanel />

          <AnomalyReasonTabs
            anomalies={anomalies}
            value={reasonFilter}
            onChange={setReasonFilter}
          />

          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('anomalies.searchPlaceholder')}
              className="w-full bg-bg-card border border-border-subtle rounded-2xl py-3 pl-11 pr-4 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-[#2ecc71]/50"
            />
          </div>

          {filteredAnomalies.length === 0 && anomalies.length > 0 ? (
            <div className="py-16 flex flex-col items-center justify-center bg-bg-card/50 rounded-3xl border-2 border-dashed border-border-subtle">
              <Search size={40} className="text-text-secondary mb-3 opacity-20" />
              <p className="text-text-secondary font-bold">{t('anomalies.noResults')}</p>
            </div>
          ) : (
            <AnomalyTable
              anomalies={filteredAnomalies}
              onUpdateStatus={updateStatus}
              onSelectAnomaly={handleSelectAnomaly}
            />
          )}
        </>
      )}

      <AnomalyTimelineModal
        data={timelineData}
        loading={timelineLoading}
        onClose={() => setTimelineData(null)}
      />

      <ConfirmModal
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={resetData}
        title={t('anomalies.reset.title')}
        message={t('anomalies.reset.message')}
        confirmText={t('anomalies.reset.confirm')}
        cancelText={t('anomalies.reset.cancel')}
        variant="danger"
      />
    </div>
  )
}
