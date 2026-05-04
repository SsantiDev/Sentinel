import { useNavigate, useLocation } from 'react-router-dom'
import { Activity, Bell, History, Settings, LogOut, Shield, Sun, Moon } from 'lucide-react'
import { useAuth } from '../../application/hooks/useAuth'
import { useTheme } from '../../application/context/ThemeContext'
import { cn } from '../../infrastructure/utils'

export function Sidebar() {
  const { logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    { icon: Activity, label: 'Dashboard', path: '/dashboard' },
    { icon: Bell, label: 'Alertas', path: '/alerts' },
    { icon: History, label: 'Historial', path: '/history' },
    { icon: Settings, label: 'Ajustes', path: '/settings' },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-bg-card border-r border-border-subtle flex-col h-screen sticky top-0 shrink-0 transition-colors duration-300">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-[#2ecc71] p-2 rounded-lg">
            <Shield className="text-[#0f0f1a]" size={24} />
          </div>
          <h1 className="text-text-primary font-bold text-xl tracking-tight">Sentinel</h1>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                location.pathname === item.path
                  ? "bg-[#2ecc71]/10 text-[#2ecc71] shadow-[0_0_20px_rgba(46,204,113,0.1)]"
                  : "text-text-secondary hover:text-text-primary hover:bg-border-subtle/50"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto space-y-2 border-t border-border-subtle">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-border-subtle/50 transition-all duration-200"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
            {isDark ? 'Modo Claro' : 'Modo Oscuro'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:text-red-400 hover:bg-red-400/5 transition-all duration-200"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-card border-t border-border-subtle flex items-center justify-around p-2 z-50 transition-colors duration-300">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
              location.pathname === item.path ? "text-[#2ecc71]" : "text-text-secondary"
            )}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
        <button
          onClick={toggleTheme}
          className="flex flex-col items-center gap-1 p-2 text-text-secondary"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
          <span className="text-[10px] font-medium">Tema</span>
        </button>
      </nav>
    </>
  )
}
