import { Search, CheckCircle2, XCircle, HelpCircle, Filter, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useHistory } from '../../application/hooks/useHistory'
import { useServices } from '../../application/hooks/useServices'
import { useTranslation } from 'react-i18next'

function StatusIcon({ status }) {
  if (status === 'up') return <CheckCircle2 size={16} className="text-[#2ecc71]" />
  if (status === 'down') return <XCircle size={16} className="text-red-400" />
  return <HelpCircle size={16} className="text-yellow-400" />
}

function LatencyBadge({ ms }) {
  if (ms == null) return <span className="text-text-secondary">—</span>
  const value = Math.round(ms)
  const color = value < 200
    ? 'text-[#2ecc71]'
    : value < 500
      ? 'text-yellow-400'
      : 'text-red-400'
  return <span className={`tabular-nums ${color}`}>{value} ms</span>
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function exportCSV(checks) {
  const headers = ['Estado', 'Servicio', 'Latencia (ms)', 'HTTP', 'Fecha']
  const rows = checks.map(c => [
    c.status,
    c.service_name,
    c.response_time_ms != null ? Math.round(c.response_time_ms) : '',
    c.status_code ?? '',
    formatDate(c.checked_at),
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `historial-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function HistoryPage() {
  const { t } = useTranslation()
  const { checks, loading, total, page, pageSize, setPage, setPageSize, filters, setFilters } = useHistory()
  const { services } = useServices()

  const totalPages = Math.ceil(total / pageSize) || 1
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const toggleStatus = () => {
    setFilters(f => ({
      ...f,
      status: f.status === '' ? 'up' : f.status === 'up' ? 'down' : ''
    }))
  }

  const toggleLatency = () => {
    setFilters(f => {
      let nextOrdering = '-response_time_ms'
      if (f.ordering === '-response_time_ms') nextOrdering = 'response_time_ms'
      else if (f.ordering === 'response_time_ms') nextOrdering = '-checked_at'
      return { ...f, ordering: nextOrdering, min_latency: '', max_latency: '' }
    })
  }

  const toggleHttp = () => {
    setFilters(f => ({ ...f, status_code: f.status_code === '400' ? '' : '400' }))
  }

  const toggleDate = () => {
    setFilters(f => {
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      if (f.start_date === today) return { ...f, start_date: yesterday, end_date: yesterday }
      if (f.start_date === yesterday) return { ...f, start_date: lastWeek, end_date: today }
      if (f.start_date === lastWeek) return { ...f, start_date: '', end_date: '' }
      return { ...f, start_date: today, end_date: today }
    })
  }

  const getStatusLabel = () => {
    if (filters.status === 'up') return ' (UP)'
    if (filters.status === 'down') return ' (DOWN)'
    return ''
  }

  const getLatencyLabel = () => {
    if (filters.ordering === '-response_time_ms') return ` ${t('history.latencyHigh')}`
    if (filters.ordering === 'response_time_ms') return ` ${t('history.latencyLow')}`
    return ''
  }

  const getDateLabel = () => {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    if (filters.start_date === today) return ` ${t('history.today')}`
    if (filters.start_date === yesterday && filters.end_date === yesterday) return ` ${t('history.yesterday')}`
    if (filters.start_date && !filters.end_date) return ` (> ${filters.start_date})`
    if (filters.start_date && filters.end_date) return ` ${t('history.last7d')}`
    return ''
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-end gap-3 mb-8 flex-wrap">

        <button
          onClick={() => exportCSV(checks)}
          disabled={checks.length === 0}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border-subtle text-text-secondary text-sm hover:text-text-primary hover:border-[#2ecc71] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={14} />
          CSV
        </button>

        <div className="w-px h-5 bg-border-subtle" />

        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span>{t('history.perPage')}</span>
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
            className="bg-bg-card border border-border-subtle text-text-primary px-2 py-1.5 rounded-lg text-sm focus:outline-none focus:border-[#2ecc71] appearance-none cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-5 bg-border-subtle" />

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <select
            value={filters.service}
            onChange={e => setFilters(f => ({ ...f, service: e.target.value }))}
            className="bg-bg-card border border-border-subtle text-text-primary pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:border-[#2ecc71] appearance-none min-w-[200px]"
          >
            <option value="">{t('history.allServices')}</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-text-secondary bg-white/5 select-none">
              <th
                className="text-left px-5 py-4 font-medium cursor-pointer hover:text-[#2ecc71] transition-colors"
                onClick={toggleStatus}
              >
                <div className="flex items-center gap-2">
                  {t('history.status')} <Filter size={12} className={filters.status ? 'text-[#2ecc71]' : 'opacity-30'} />
                  <span className="text-[10px] font-bold text-[#2ecc71]">{getStatusLabel()}</span>
                </div>
              </th>
              <th className="text-left px-5 py-4 font-medium">{t('history.service')}</th>
              <th
                className="text-left px-5 py-4 font-medium hidden md:table-cell cursor-pointer hover:text-[#2ecc71] transition-colors"
                onClick={toggleLatency}
              >
                <div className="flex items-center gap-2">
                  {t('history.latency')} <Filter size={12} className={filters.ordering.includes('response_time') ? 'text-[#2ecc71]' : 'opacity-30'} />
                  <span className="text-[10px] font-bold text-[#2ecc71]">{getLatencyLabel()}</span>
                </div>
              </th>
              <th
                className="text-left px-5 py-4 font-medium hidden md:table-cell cursor-pointer hover:text-[#2ecc71] transition-colors"
                onClick={toggleHttp}
              >
                <div className="flex items-center gap-2">
                  {t('history.http')} <Filter size={12} className={filters.status_code ? 'text-[#2ecc71]' : 'opacity-30'} />
                  <span className="text-[10px] font-bold text-[#2ecc71]">{filters.status_code ? ' (ERR)' : ''}</span>
                </div>
              </th>
              <th
                className="text-left px-5 py-4 font-medium cursor-pointer hover:text-[#2ecc71] transition-colors"
                onClick={toggleDate}
              >
                <div className="flex items-center gap-2">
                  {t('history.date')} <Filter size={12} className={filters.start_date ? 'text-[#2ecc71]' : 'opacity-30'} />
                  <span className="text-[10px] font-bold text-[#2ecc71]">{getDateLabel()}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
            {loading && checks.length === 0 ? (
              Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                <tr key={i} className="border-b border-border-subtle">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-4 bg-border-subtle rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : checks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-text-secondary">
                  {t('history.noRecords')}
                </td>
              </tr>
            ) : checks.map(c => (
              <tr
                key={c.id}
                className={`border-b border-border-subtle last:border-0 transition-colors ${
                  c.status === 'down'
                    ? 'bg-red-500/5 hover:bg-red-500/10'
                    : 'hover:bg-white/5'
                }`}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={c.status} />
                    <span className="capitalize text-text-primary">{c.status}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-text-primary">{c.service_name}</td>
                <td className="px-5 py-3 hidden md:table-cell">
                  <LatencyBadge ms={c.response_time_ms} />
                </td>
                <td className="px-5 py-3 hidden md:table-cell">
                  <span className={c.status_code >= 400 || !c.status_code ? 'text-red-400' : 'text-[#2ecc71]'}>
                    {c.status_code ?? '—'}
                  </span>
                </td>
                <td className="px-5 py-3 text-text-secondary">{formatDate(c.checked_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
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
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
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
                )
              })}
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
        )}
      </div>
    </div>
  )
}
