import { useState, useEffect } from 'react'
import { ChevronRight, ChevronLeft, Clock } from 'lucide-react'
import { getEffectiveExpiration, getPayload } from '../../infrastructure/authStorage'
import { useTranslation } from 'react-i18next'

const COLLAPSED_KEY = 'sentinel_timer_collapsed'

function formatTime(ms) {
  if (ms <= 0) return '0:00'
  const totalSecs = Math.floor(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function getColor(ratio) {
  if (ratio > 0.5) return '#2ecc71'
  if (ratio > 0.25) return '#f39c12'
  return '#e74c3c'
}

const RING_SIZE = 76
const STROKE = 5
const R = (RING_SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * R

export function SessionTimer() {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === 'true'
  )
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalMs, setTotalMs] = useState(1)

  useEffect(() => {
    const tick = () => {
      const exp = getEffectiveExpiration()
      const payload = getPayload()
      if (!exp || !payload?.iat) return
      const left = Math.max(0, exp - Date.now())
      const total = exp - payload.iat * 1000
      setTimeLeft(left)
      setTotalMs(total > 0 ? total : 1)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const toggle = () =>
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(COLLAPSED_KEY, String(next))
      return next
    })

  const exp = getEffectiveExpiration()
  if (!exp) return null

  const ratio = Math.max(0, Math.min(1, timeLeft / totalMs))
  const color = getColor(ratio)
  const dash = CIRCUMFERENCE * ratio
  const pct = Math.round(ratio * 100)

  if (collapsed) {
    return (
      <div
        onClick={toggle}
        title={t('sessionTimer.expand')}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 cursor-pointer group"
      >
        <div className="bg-bg-card border border-border-subtle border-r-0 rounded-l-2xl px-2 py-5 flex flex-col items-center gap-2 shadow-xl transition-all group-hover:px-3">
          <ChevronLeft size={10} className="text-text-secondary group-hover:text-text-primary transition-colors" />
          <div className="w-1.5 h-20 rounded-full bg-border-subtle overflow-hidden flex flex-col-reverse">
            <div
              className="w-full rounded-full transition-all duration-1000"
              style={{ height: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <Clock size={10} style={{ color }} />
          <span
            className="text-[8px] font-black tabular-nums"
            style={{ color, writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {pct}%
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40">
      <div className="bg-bg-card border border-border-subtle rounded-3xl p-5 shadow-2xl flex flex-col items-center gap-3 w-[120px]">

        <div className="flex items-center justify-between w-full">
          <span className="text-[8px] font-black uppercase tracking-[0.25em]" style={{ color }}>
            {t('sessionTimer.label')}
          </span>
          <button
            onClick={toggle}
            title={t('sessionTimer.collapse')}
            className="text-text-secondary hover:text-text-primary transition-colors ml-1"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        <div className="relative">
          <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
              fill="none"
              strokeWidth={STROKE}
              stroke="currentColor"
              className="text-border-subtle"
            />
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
              fill="none"
              strokeWidth={STROKE}
              stroke={color}
              strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s linear, stroke 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="text-text-primary font-black text-sm leading-none tabular-nums">
              {formatTime(timeLeft)}
            </span>
            <span className="text-[9px] font-bold tabular-nums" style={{ color }}>
              {pct}%
            </span>
          </div>
        </div>

        <p className="text-text-secondary text-[9px] font-medium text-center leading-tight">
          {t('sessionTimer.remaining')}
        </p>
      </div>
    </div>
  )
}
