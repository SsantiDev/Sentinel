import { Link, Navigate } from 'react-router-dom'
import { GalaxyBackground } from '../components/GalaxyBackground'
import { DemoChecker } from '../components/DemoChecker'
import { useTheme } from '../../application/context/ThemeContext'
import { getToken } from '../../infrastructure/authStorage'
import logo from '../../assets/logo.png'

const FEATURES = [
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    title: 'Health Checks Automáticos',
    desc: 'Monitorea URLs y APIs en tiempo real. Detección inmediata de caídas.',
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
    title: 'Alertas Inteligentes',
    desc: 'Notificaciones por email o Slack cuando un servicio falla o la latencia sube.',
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    title: 'Métricas de Latencia',
    desc: 'Gráficas históricas para detectar degradación gradual antes de una caída.',
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    title: 'Historial Completo',
    desc: 'Registro con filtros avanzados por fecha, estado y código HTTP.',
  },
]

const STEPS = [
  { n: '01', title: 'Crea tu cuenta', desc: 'Registro gratuito en segundos. Sin tarjeta de crédito.' },
  { n: '02', title: 'Agrega un servicio', desc: 'Ingresa la URL o API que quieres monitorear.' },
  { n: '03', title: 'Recibe alertas', desc: 'Sentinel verifica automáticamente y te avisa si algo falla.' },
]

const PLAN_TRIAL = [
  { label: 'Servicios', value: '3 máximo' },
  { label: 'Alertas por email', value: '30 / cuenta' },
  { label: 'Historial de checks', value: '2 días' },
  { label: 'Duración de sesión', value: '60 minutos' },
]

const PLAN_PRO = [
  { label: 'Servicios', value: 'Ilimitados' },
  { label: 'Alertas por email', value: 'Ilimitadas' },
  { label: 'Historial de checks', value: 'Completo' },
  { label: 'Duración de sesión', value: 'Sin restricción' },
]

export function LandingPage() {
  const { isDark, toggleTheme } = useTheme()

  if (getToken()) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen" style={{ color: 'var(--text-primary)' }}>
      <GalaxyBackground />

      {/* NAV — full width */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 glass-card"
        style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
      >
        <div className="w-full px-6 sm:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Sentinel" className="w-8 h-8 object-contain" />
            <span className="font-black text-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>
              SENTINEL
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-all cursor-pointer hover:border-[#2ecc71] hover:text-[#2ecc71] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(46,204,113,0.2)] active:scale-95"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              title={isDark ? 'Modo claro' : 'Modo oscuro'}
            >
              {isDark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:text-[#2ecc71] hover:border-[#2ecc71] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(46,204,113,0.15)] active:scale-95"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              Ingresar
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-xl bg-[#2ecc71] text-[#0f0f1a] font-black text-sm hover:bg-[#27ae60] transition-all shadow-[0_2px_12px_rgba(46,204,113,0.3)]"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20">
        <img src={logo} alt="Sentinel" className="w-20 h-20 object-contain mb-6" />
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-[#2ecc71] text-sm font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-[#2ecc71] animate-pulse inline-block" />
          Monitor de servicios en tiempo real
        </div>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-4" style={{ color: 'var(--text-primary)' }}>
          SENTINEL
        </h1>
        <p className="text-xl max-w-lg mx-auto mb-10" style={{ color: 'var(--text-secondary)' }}>
          Monitorea tus APIs y servicios web. Detecta caídas antes que tus usuarios.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/register" className="px-8 py-4 rounded-2xl bg-[#2ecc71] text-[#0f0f1a] font-black text-lg hover:bg-[#27ae60] hover:scale-105 active:scale-95 transition-all shadow-[0_4px_24px_rgba(46,204,113,0.4)]">
            Empezar gratis
          </Link>
          <Link to="/login" className="px-8 py-4 rounded-2xl glass-card font-semibold text-lg hover:text-[#2ecc71] transition-all">
            Ingresar
          </Link>
        </div>
        <div className="mt-16 flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Saber más
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-3" style={{ color: 'var(--text-primary)' }}>Todo lo que necesitas</h2>
          <p className="text-center mb-16" style={{ color: 'var(--text-secondary)' }}>Sin configuraciones complejas. Funcionando en minutos.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass-card rounded-2xl p-6 transition-all hover:shadow-[0_0_24px_rgba(46,204,113,0.1)]">
                <div className="mb-4 text-[#2ecc71]">{f.icon}</div>
                <h3 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-6" style={{ background: 'rgba(var(--card-rgb), 0.25)' }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-3" style={{ color: 'var(--text-primary)' }}>Cómo funciona</h2>
          <p className="text-center mb-16" style={{ color: 'var(--text-secondary)' }}>Tres pasos y listo.</p>
          <div className="space-y-6">
            {STEPS.map((s) => (
              <div key={s.n} className="glass-card rounded-2xl p-6 flex gap-6 items-start">
                <span className="text-4xl font-black leading-none flex-shrink-0" style={{ color: 'rgba(46,204,113,0.35)' }}>{s.n}</span>
                <div>
                  <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>{s.title}</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-3" style={{ color: 'var(--text-primary)' }}>Planes</h2>
          <p className="text-center mb-16" style={{ color: 'var(--text-secondary)' }}>Empieza gratis, sin límite de tiempo.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Trial */}
            <div className="glass-card rounded-2xl p-8 flex flex-col gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Trial</p>
                <p className="text-4xl font-black" style={{ color: 'var(--text-primary)' }}>Gratis</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Sin tarjeta · Sin límite de tiempo</p>
              </div>
              <ul className="space-y-3 flex-1">
                {PLAN_TRIAL.map((item) => (
                  <li key={item.label} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                  </li>
                ))}
              </ul>
              <Link to="/register" className="block text-center py-3 rounded-xl bg-[#2ecc71] text-[#0f0f1a] font-black hover:bg-[#27ae60] transition-all">
                Empezar gratis
              </Link>
            </div>
            {/* Pro */}
            <div className="glass-card rounded-2xl p-8 flex flex-col gap-6" style={{ borderColor: 'rgba(46,204,113,0.4)', boxShadow: '0 0 32px rgba(46,204,113,0.08)' }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#2ecc71' }}>Pro / Admin</p>
                <p className="text-4xl font-black" style={{ color: 'var(--text-primary)' }}>Sin límites</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Para equipos y producción</p>
              </div>
              <ul className="space-y-3 flex-1">
                {PLAN_PRO.map((item) => (
                  <li key={item.label} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span className="font-semibold" style={{ color: '#2ecc71' }}>{item.value}</span>
                  </li>
                ))}
              </ul>
              <a href="mailto:ssantiago.xz1130@gmail.com" className="block text-center py-3 rounded-xl font-black transition-all" style={{ border: '1px solid rgba(46,204,113,0.4)', color: '#2ecc71' }}>
                Contactar
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section className="py-24 px-6" style={{ background: 'rgba(var(--card-rgb), 0.25)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: 'var(--text-primary)' }}>Pruébalo ahora</h2>
          <p className="mb-10" style={{ color: 'var(--text-secondary)' }}>Ingresa cualquier URL pública y verifica su estado en tiempo real.</p>
          <DemoChecker />
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: 'var(--text-primary)' }}>¿Listo para monitorear?</h2>
          <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>Crea tu cuenta gratis y empieza en minutos.</p>
          <Link to="/register" className="inline-block px-10 py-4 rounded-2xl bg-[#2ecc71] text-[#0f0f1a] font-black text-lg hover:bg-[#27ae60] hover:scale-105 active:scale-95 transition-all shadow-[0_4px_24px_rgba(46,204,113,0.4)]">
            Crear cuenta gratis →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-6 text-center text-sm" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        <p>© 2026 Sentinel Monitor · Mantén tus servicios activos</p>
      </footer>
    </div>
  )
}
