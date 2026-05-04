import { User, Database, Globe } from 'lucide-react'

export function SettingsPage() {
  const sections = [
    { icon: User, title: 'Perfil', desc: 'Configuración de cuenta y contraseña' },
    { icon: Database, title: 'Base de Datos', desc: 'Ajustes de persistencia y backups' },
    { icon: Globe, title: 'Sistema', desc: 'Intervalos globales y notificaciones' },
  ]

  return (
    <div className="w-full">
      <div className="mb-10">
        <h2 className="text-text-primary text-3xl font-black tracking-tight mb-2">Ajustes</h2>
        <p className="text-text-secondary text-sm">Configuración general de la plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sections.map((sec) => (
          <div key={sec.title} className="bg-bg-card border border-border-subtle p-8 rounded-3xl hover:border-[#2ecc71]/50 transition-all group">
            <div className="bg-bg-main w-12 h-12 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#2ecc71]/20 transition-colors">
              <sec.icon className="text-text-secondary group-hover:text-[#2ecc71] transition-colors" size={24} />
            </div>
            <h3 className="text-text-primary font-bold text-lg mb-2">{sec.title}</h3>
            <p className="text-text-secondary text-sm leading-relaxed mb-6">{sec.desc}</p>
            <button className="text-[10px] font-black uppercase tracking-widest text-[#2ecc71] hover:underline">
              Configurar →
            </button>
          </div>
        ))}
      </div>

      <div className="mt-12 bg-bg-card border border-border-subtle rounded-3xl p-8">
        <h3 className="text-text-primary font-bold mb-4">Información del Sistema</h3>
        <div className="space-y-4">
          <div className="flex justify-between border-b border-border-subtle pb-4">
            <span className="text-text-secondary text-sm">Versión de Sentinel</span>
            <span className="text-text-secondary font-mono text-xs">v1.0.4-beta</span>
          </div>
          <div className="flex justify-between border-b border-border-subtle pb-4">
            <span className="text-text-secondary text-sm">Estado del Backend</span>
            <span className="text-green-500 font-mono text-xs uppercase font-bold tracking-tighter flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
              Operacional
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
