import { useNavigate, useLocation } from 'react-router-dom'
import { Activity, Bell, History, Settings, LogOut, Sun, Moon, Users, Share2, AlertTriangle, CreditCard, ScrollText } from 'lucide-react'
import { useAuth } from '../../application/hooks/useAuth'
import { useTheme } from '../../application/context/ThemeContext'
import { cn } from '../../infrastructure/utils'
import logo from '../../assets/logo.png'
import { useTranslation } from 'react-i18next'

export function Sidebar() {
  const { logout, isSuperUser } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  const menuItems = [
    { icon: Activity, label: t('nav.dashboard'), path: '/dashboard' },
    { icon: Bell, label: t('nav.alerts'), path: '/alerts' },
    { icon: History, label: t('nav.history'), path: '/history' },
    { icon: Share2, label: t('nav.topology'), path: '/topology' },
    { icon: CreditCard, label: t('nav.simulator'), path: '/transactions' },
    { icon: Settings, label: t('nav.settings'), path: '/settings' },
  ]

  if (isSuperUser) {
    menuItems.push({ icon: Users, label: t('nav.admin'), path: '/admin' })
    menuItems.push({ icon: AlertTriangle, label: t('nav.anomalies'), path: '/anomalies' })
    menuItems.push({ icon: ScrollText, label: t('nav.logs'), path: '/logs' })
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-bg-card border-r border-border-subtle flex-col h-screen sticky top-0 shrink-0 transition-colors duration-300">
        <div 
          onClick={() => navigate('/dashboard')}
          className="p-5 flex items-center justify-center gap-3 cursor-pointer hover:opacity-80 transition-all border-b border-border-subtle"
        >
          <img src={logo} alt="Sentinel" className="w-12 h-12 object-contain" />
          <h1 className="text-text-primary font-bold text-xl tracking-wider uppercase">
            Sentinel
          </h1>
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
            {isDark ? t('nav.lightMode') : t('nav.darkMode')}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:text-red-400 hover:bg-red-400/5 transition-all duration-200"
          >
            <LogOut size={18} />
            {t('nav.logout')}
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
          <span className="text-[10px] font-medium">{t('nav.theme')}</span>
        </button>
      </nav>
    </>
  )
}
