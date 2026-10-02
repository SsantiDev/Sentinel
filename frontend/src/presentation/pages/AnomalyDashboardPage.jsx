import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnomalyDashboard } from '../../application/hooks/useAnomalyDashboard'
import { AnomalyStatCards } from '../components/AnomalyStatCards'
import { AnomalyBreakdown } from '../components/AnomalyBreakdown'
import { AnomalyHourlyChart } from '../components/AnomalyHourlyChart'
import { AnomalyTrendChart } from '../components/AnomalyTrendChart'
import { AnomalyTable } from '../components/AnomalyTable'
import { AnomalyTimelineModal } from '../components/AnomalyTimelineModal'

export function AnomalyDashboardPage() {
  const { t } = useTranslation()
  const { stats, trends, anomalies, loading, error, updateStatus, fetchTimeline } = useAnomalyDashboard()
  const [timelineData, setTimelineData] = useState(null)
  const [timelineLoading, setTimelineLoading] = useState(false)

  const handleSelectAnomaly = async (anomaly) => {
    setTimelineLoading(true)
    try {
      const data = await fetchTimeline(anomaly.id)
      setTimelineData(data)
    } finally {
      setTimelineLoading(false)
    }
  }

  if (loading) {
    return <div className="text-text-secondary text-sm">...</div>
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-400">
        {error}
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-10">
        <h1 className="text-2xl font-black text-text-primary tracking-tight">{t('anomalies.title')}</h1>
        <p className="text-text-secondary text-sm mt-1">{t('anomalies.subtitle')}</p>
      </div>

      <AnomalyStatCards stats={stats} />

      <AnomalyBreakdown stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 h-80">
          <h3 className="text-sm font-black text-text-primary uppercase tracking-widest mb-4">
            {t('anomalies.hourlyDistribution')}
          </h3>
          <div className="h-[calc(100%-2rem)]">
            <AnomalyHourlyChart hourlyDistribution={trends.hourly_distribution} />
          </div>
        </div>

        <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 h-80">
          <h3 className="text-sm font-black text-text-primary uppercase tracking-widest mb-4">
            {t('anomalies.dailyEvolution')}
          </h3>
          <div className="h-[calc(100%-2rem)]">
            <AnomalyTrendChart dailyEvolution={trends.daily_evolution} />
          </div>
        </div>
      </div>

      <AnomalyTable
        anomalies={anomalies}
        onUpdateStatus={updateStatus}
        onSelectAnomaly={handleSelectAnomaly}
      />

      <AnomalyTimelineModal
        data={timelineData}
        loading={timelineLoading}
        onClose={() => setTimelineData(null)}
      />
    </div>
  )
}
