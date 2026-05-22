import { useState } from 'react'
import axios from 'axios'

export function DemoChecker() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleCheck = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const { data } = await axios.post('/api/v1/public/check/', { url: url.trim() })
      setResult(data)
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Límite alcanzado: 10 verificaciones por hora por IP. Regístrate para monitoreo continuo.')
      } else {
        setError(err.response?.data?.error || 'Error al verificar la URL. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleCheck} className="w-full max-w-xl mx-auto space-y-4">
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://tu-sitio.com"
          className="flex-1 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2ecc71] focus:ring-1 focus:ring-[#2ecc71] transition-all"
          style={{
            background: 'rgba(var(--card-rgb), 0.5)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="bg-[#2ecc71] text-[#0f0f1a] font-black px-6 py-3 rounded-xl hover:bg-[#27ae60] transition-all disabled:opacity-50 whitespace-nowrap text-sm"
        >
          {loading ? 'Verificando…' : 'Verificar'}
        </button>
      </div>

      {error && (
        <div
          className="glass-card rounded-xl p-4 text-sm"
          style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
        >
          {error}
        </div>
      )}

      {result && (
        <div className="glass-card rounded-xl p-5 flex items-center gap-4 text-left">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl font-black"
            style={{
              background: result.status === 'up' ? 'rgba(46,204,113,0.15)' : 'rgba(239,68,68,0.15)',
              color: result.status === 'up' ? '#2ecc71' : '#f87171',
            }}
          >
            {result.status === 'up' ? '✓' : '✗'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {result.status === 'up' ? 'Servicio Activo' : 'Servicio Caído'}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {result.status_code && <span>HTTP {result.status_code} · </span>}
              {result.response_time_ms
                ? <span className="font-medium" style={{ color: '#2ecc71' }}>{result.response_time_ms}ms</span>
                : <span>{result.error_message}</span>}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
              {result.url}
            </p>
          </div>
        </div>
      )}
    </form>
  )
}
