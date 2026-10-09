import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../infrastructure/utils'
import { useAnomalyDashboard } from '../../application/hooks/useAnomalyDashboard'
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
import { AnomalyTimelineModal } from '../components/AnomalyTimelineModal'
import { SkeletonCard } from '../components/SkeletonCard'

const TABS = ['overview', 'analysis', 'anomalies']

export function AnomalyDashboardPage() {
  const { t } = useTranslation()
  const { stats, trends, anomalies, loading, error, updateStatus, fetchTimeline } = useAnomalyDashboard()
  const [tab, setTab] = useState('overview')
  const [timelineData, setTimelineData] = useState(null)
  const [timelineLoading, setTimelineLoading] = useState(false)

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

  return (
    <div className="w-full">
      <div className="flex gap-1 p-1 bg-bg-card border border-border-subtle rounded-2xl mb-8 sm:inline-flex">
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

          <AnomalyTable
            anomalies={anomalies}
            onUpdateStatus={updateStatus}
            onSelectAnomaly={handleSelectAnomaly}
          />
        </>
      )}

      <AnomalyTimelineModal
        data={timelineData}
        loading={timelineLoading}
        onClose={() => setTimelineData(null)}
      />
    </div>
  )
}
