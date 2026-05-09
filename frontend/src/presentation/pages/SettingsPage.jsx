import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  User, Bell, Shield, Database, Save, Loader2, CheckCircle2,
  AlertCircle, ChevronRight, Mail, Clock, ShieldCheck, HardDrive,
  Activity, Globe, Lock, Trash2, Languages
} from 'lucide-react'
import { useSettings } from '../../application/hooks/useSettings'
import { useLimits } from '../../application/hooks/useLimits'
import { cn } from '../../infrastructure/utils'
import { isAdmin } from '../../infrastructure/authStorage'
import { ContactAdminButton } from '../components/ContactAdminButton'

export function SettingsPage() {
  const { config, loading, error, updateConfig, updateProfile } = useSettings()
  const { limits } = useLimits()
  const { t, i18n } = useTranslation()
  const isUserAdmin = isAdmin()
  const emailsUsed = limits?.emails?.used ?? 0
  const emailAtLimit = !isUserAdmin && emailsUsed >= 30
  const [activeTab, setActiveTab] = useState('profile')
  const [saveStatus, setSaveStatus] = useState({ show: false, success: true, message: '' })

  const [profileForm, setProfileForm] = useState({ 
    current: '', 
    new: '', 
    confirm: '',
    session_timeout: config?.security?.session_timeout_minutes || 480 
  })

  useEffect(() => {
    if (config?.security?.session_timeout_minutes !== undefined) {
      setProfileForm(prev => ({ ...prev, session_timeout: config.security.session_timeout_minutes }))
    }
  }, [config?.security?.session_timeout_minutes])

  const showStatus = (success, message) => {
    setSaveStatus({ show: true, success, message })
    setTimeout(() => setSaveStatus({ show: false, success: true, message: '' }), 3000)
  }

  const handleConfigUpdate = async (section, data) => {
    const res = await updateConfig(section, data)
    if (res.success) {
      showStatus(true, t('settings.saved'))
    } else {
      showStatus(false, res.error)
    }
  }

  const handleSessionUpdate = async (e) => {
    e.preventDefault()
    const res = await updateProfile({
      session_timeout_minutes: profileForm.session_timeout
    })
    if (res.success) {
      showStatus(true, t('settings.sessionUpdated'))
    } else {
      showStatus(false, res.error)
    }
  }

  const handlePasswordUpdate = async (e) => {
    e.preventDefault()
    if (!profileForm.current || !profileForm.new) {
      showStatus(false, t('settings.fillPasswordFields'))
      return
    }
    if (profileForm.new !== profileForm.confirm) {
      showStatus(false, t('settings.passwordMismatch'))
      return
    }

    const res = await updateProfile({
      current_password: profileForm.current,
      new_password: profileForm.new
    })

    if (res.success) {
      showStatus(true, t('settings.passwordUpdated'))
      setProfileForm({ ...profileForm, current: '', new: '', confirm: '' })
    } else {
      showStatus(false, res.error)
    }
  }

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-[#2ecc71]" size={48} />
        <p className="text-text-secondary font-medium animate-pulse">{t('settings.syncing')}</p>
      </div>
    )
  }

  if (error || !config) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
        <AlertCircle className="text-red-500" size={48} />
        <p className="text-text-secondary font-medium">{error || t('settings.loadError')}</p>
      </div>
    )
  }

  const tabs = [
    { id: 'profile', label: t('settings.profile') },
    { id: 'notifications', label: t('settings.notifications') },
    ...(isUserAdmin ? [
      { id: 'system', label: t('settings.system') },
      { id: 'security', label: t('settings.security') },
    ] : [])
  ]

  const containerVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } }
  }

  const renderProfile = () => (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-12 gap-8 pb-10 h-full">
      <div className="col-span-12 lg:col-span-7 flex flex-col gap-8">
        <div className="bg-bg-card border border-border-subtle rounded-[3rem] p-12 shadow-sm">
          <h3 className="text-text-primary font-black text-3xl mb-10 tracking-tight">{t('settings.sessionPrefs')}</h3>

          {isUserAdmin ? (
            <form onSubmit={handleSessionUpdate} className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2ecc71] ml-1">{t('settings.sessionTimeout')}</label>
                <div className="flex items-center gap-6">
                  <input
                    type="number"
                    value={profileForm.session_timeout}
                    onChange={(e) => setProfileForm({...profileForm, session_timeout: parseInt(e.target.value)})}
                    className="w-40 bg-bg-main/50 border border-border-subtle rounded-3xl px-8 py-5 text-4xl font-black focus:outline-none focus:border-[#2ecc71] transition-all"
                  />
                  <div className="flex-1">
                    <p className="text-text-primary font-bold">{t('settings.sessionIndependent')}</p>
                    <p className="text-text-secondary text-xs">{t('settings.sessionDesc')}</p>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-[#2ecc71] text-white h-16 rounded-3xl text-xs font-black uppercase tracking-[0.3em] hover:scale-[1.01] transition-all shadow-xl shadow-[#2ecc71]/20"
              >
                {t('settings.saveSession')}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-6 bg-bg-main/40 border border-border-subtle rounded-2xl">
                <div className="flex-shrink-0 p-3 bg-border-subtle/50 rounded-xl">
                  <Lock className="text-text-secondary" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary font-bold text-sm">{t('trial.sessionLocked')}</p>
                  <p className="text-text-secondary text-xs mt-1 leading-relaxed">{t('trial.sessionLockedDesc')}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-[#2ecc71] font-black text-2xl leading-none">60</p>
                  <p className="text-text-secondary text-[10px] uppercase font-bold">min</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-1">
                <p className="text-text-secondary text-[10px] uppercase tracking-widest font-bold">{t('trial.retentionNote')}</p>
                <ContactAdminButton subject="Sentinel - Ampliar sesión de plan de prueba" />
              </div>
            </div>
          )}
        </div>

        {/* Panel de Seguridad (Vuelve a la izquierda) */}
        <div className="bg-bg-card border border-border-subtle rounded-[3rem] p-12 shadow-sm">
          <h4 className="text-text-primary font-bold text-xl uppercase tracking-tighter mb-8">{t('settings.accountSecurity')}</h4>
          <form onSubmit={handlePasswordUpdate} className="space-y-6">
            <input type="text" name="username" autoComplete="username" className="hidden" />
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">{t('settings.currentPassword')}</label>
              <input
                type="password"
                autoComplete="current-password"
                value={profileForm.current}
                onChange={(e) => setProfileForm({...profileForm, current: e.target.value})}
                className="w-full bg-bg-main/50 border border-border-subtle rounded-3xl px-8 py-5 text-base focus:outline-none focus:border-[#2ecc71] transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">{t('settings.newPassword')}</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={profileForm.new}
                  onChange={(e) => setProfileForm({...profileForm, new: e.target.value})}
                  className="w-full bg-bg-main/50 border border-border-subtle rounded-3xl px-8 py-4 text-base focus:outline-none focus:border-[#2ecc71] transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">{t('settings.confirmPassword')}</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={profileForm.confirm}
                  onChange={(e) => setProfileForm({...profileForm, confirm: e.target.value})}
                  className="w-full bg-bg-main/50 border border-border-subtle rounded-3xl px-8 py-4 text-base focus:outline-none focus:border-[#2ecc71] transition-all"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-text-primary text-bg-card h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:opacity-90 transition-all"
            >
              {t('settings.updatePassword')}
            </button>
          </form>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-5 flex flex-col gap-8 sticky top-0 h-fit">
        {/* Panel de Hardening */}
        <div className="bg-[#2ecc71]/5 border border-[#2ecc71]/20 rounded-[3rem] p-10 flex flex-col justify-center">
          <h4 className="text-[#2ecc71] font-black text-[10px] uppercase tracking-[0.3em] mb-6">{t('settings.hardeningActive')}</h4>
          <div className="space-y-6">
            <div>
              <p className="text-text-primary text-4xl font-black tracking-tighter leading-none mb-2">
                {isUserAdmin ? `${profileForm.session_timeout}m` : '60m'}
              </p>
              <p className="text-text-secondary text-xs uppercase font-bold">{t('settings.sessionExpiry')}</p>
              {!isUserAdmin && (
                <p className="text-text-secondary text-[10px] mt-1">{t('trial.planBadge')}</p>
              )}
            </div>
            <div className="pt-6 border-t border-[#2ecc71]/10">
              <p className="text-text-secondary text-[10px] leading-relaxed italic">
                {t('settings.securityQuote')}
              </p>
            </div>
          </div>
        </div>

        {/* Panel de Idioma */}
        <div className="bg-bg-card border border-border-subtle rounded-[3rem] p-10 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h4 className="text-text-primary font-bold text-lg uppercase tracking-tighter">{t('settings.language')}</h4>
            <Languages className="text-[#2ecc71]" size={20} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                i18n.changeLanguage('es')
                localStorage.setItem('sentinel_lang', 'es')
              }}
              className={cn(
                "flex items-center justify-center gap-2 h-12 rounded-xl font-black transition-all border text-[10px]",
                i18n.language === 'es' ? "bg-[#2ecc71]/10 border-[#2ecc71] text-[#2ecc71]" : "bg-bg-main/50 border-border-subtle text-text-secondary"
              )}
            >
              <span className="text-sm">🇪🇸</span> ES
            </button>
            <button
              onClick={() => {
                i18n.changeLanguage('en')
                localStorage.setItem('sentinel_lang', 'en')
              }}
              className={cn(
                "flex items-center justify-center gap-2 h-12 rounded-xl font-black transition-all border text-[10px]",
                i18n.language === 'en' ? "bg-[#2ecc71]/10 border-[#2ecc71] text-[#2ecc71]" : "bg-bg-main/50 border-border-subtle text-text-secondary"
              )}
            >
              <span className="text-sm">🇺🇸</span> EN
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="flex flex-col h-full w-full">
      <header className="mb-10 flex justify-end items-center">
        <AnimatePresence>
          {saveStatus.show && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={cn(
                "flex items-center gap-3 px-8 py-4 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl backdrop-blur-xl",
                saveStatus.success ? "bg-[#2ecc71]/10 text-[#2ecc71] border border-[#2ecc71]/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
              )}
            >
              {saveStatus.message}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="flex flex-1 gap-10 min-h-0">
        <nav className="w-64 shrink-0 space-y-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full group flex flex-col p-8 rounded-[2rem] text-left transition-all duration-500 border",
                activeTab === tab.id
                  ? "bg-bg-card border-[#2ecc71] shadow-[0_20px_50px_rgba(46,204,113,0.12)]"
                  : "bg-transparent border-transparent hover:bg-bg-card/40 hover:border-border-subtle"
              )}
            >
              <span className={cn(
                "text-xl font-black transition-colors uppercase tracking-tight",
                activeTab === tab.id ? "text-text-primary" : "text-text-secondary/60 group-hover:text-text-primary"
              )}>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="h-full"
            >
              <div className="h-full overflow-y-auto pr-4 custom-scrollbar">
                {activeTab === 'profile' && renderProfile()}

                {activeTab === 'notifications' && (
                  isUserAdmin ? (
                    <div className="grid grid-cols-12 gap-8 pb-10">
                      <div className="col-span-12 lg:col-span-7 bg-bg-card border border-border-subtle rounded-[3rem] p-12">
                        <h3 className="text-text-primary font-black text-3xl mb-10 tracking-tight uppercase">{t('settings.emailDestination')}</h3>
                        <div className="space-y-6">
                          <div className="flex items-center gap-6 p-8 bg-bg-main/30 rounded-[2rem] border border-border-subtle">
                            <Mail className="text-[#2ecc71]" size={32} />
                            <div className="flex-1">
                              <input
                                type="email"
                                defaultValue={config.notifications.global_email}
                                onBlur={(e) => handleConfigUpdate('notifications', { global_email: e.target.value })}
                                className="w-full bg-transparent text-2xl font-black text-text-primary focus:outline-none"
                                placeholder="admin@sentinel.cloud"
                              />
                              <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest mt-2">{t('settings.alertEndpoint')}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={cn(
                        "col-span-12 lg:col-span-5 rounded-[3rem] p-12 flex flex-col justify-between transition-all duration-500",
                        config.notifications.alert_on_failure ? "bg-[#2ecc71] text-white" : "bg-bg-card border border-border-subtle text-text-primary"
                      )}>
                        <div>
                          <h4 className={cn("font-black text-[10px] uppercase tracking-[0.3em] mb-4", config.notifications.alert_on_failure ? "text-white/70" : "text-text-secondary")}>{t('settings.channelStatus')}</h4>
                          <h3 className="text-4xl font-black tracking-tight mb-4">{t('settings.pushAlerts')}</h3>
                          <p className={cn("text-sm leading-relaxed", config.notifications.alert_on_failure ? "text-white/80" : "text-text-secondary")}>
                            {t('settings.pushAlertsDesc')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleConfigUpdate('notifications', { alert_on_failure: !config.notifications.alert_on_failure })}
                          className={cn(
                            "w-full h-14 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all",
                            config.notifications.alert_on_failure ? "bg-white text-[#2ecc71] shadow-2xl" : "bg-border-subtle text-text-secondary"
                          )}
                        >
                          {config.notifications.alert_on_failure ? t('settings.deactivateAlerts') : t('settings.activateAlerts')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Trial user notifications view */
                    <div className="grid grid-cols-12 gap-8 pb-10">
                      <div className="col-span-12 lg:col-span-7 bg-bg-card border border-border-subtle rounded-[3rem] p-12">
                        <h3 className="text-text-primary font-black text-3xl mb-2 tracking-tight uppercase">{t('trial.emailDestTitle')}</h3>
                        <p className="text-text-secondary text-sm mb-10">{t('trial.emailDestDesc')}</p>

                        {emailAtLimit ? (
                          <div className="space-y-6">
                            <div className="flex items-center gap-4 p-6 bg-red-500/5 border border-red-500/20 rounded-2xl">
                              <Lock className="text-red-400 flex-shrink-0" size={20} />
                              <div className="flex-1 min-w-0">
                                <p className="text-red-400 font-bold text-sm">{t('trial.emailAtLimitBanner')}</p>
                                <p className="text-text-secondary text-xs mt-1 leading-relaxed">{t('trial.emailLimitDesc')}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-6 p-8 bg-bg-main/30 rounded-[2rem] border border-border-subtle opacity-40 pointer-events-none select-none">
                              <Mail className="text-text-secondary" size={32} />
                              <div className="flex-1">
                                <p className="text-text-secondary text-2xl font-black">{config.notifications.global_email || '—'}</p>
                                <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest mt-2">{t('settings.alertEndpoint')}</p>
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <ContactAdminButton label={t('trial.contactAdmin')} subject="Sentinel - Ampliar límite de emails" />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div className="flex items-center gap-6 p-8 bg-bg-main/30 rounded-[2rem] border border-border-subtle">
                              <Mail className="text-[#2ecc71]" size={32} />
                              <div className="flex-1">
                                <input
                                  type="email"
                                  defaultValue={config.notifications.global_email}
                                  onBlur={(e) => handleConfigUpdate('notifications', { global_email: e.target.value })}
                                  className="w-full bg-transparent text-2xl font-black text-text-primary focus:outline-none"
                                  placeholder="tu@email.com"
                                />
                                <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest mt-2">{t('settings.alertEndpoint')}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
                        <div className="bg-bg-card border border-border-subtle rounded-[3rem] p-10">
                          <h4 className="text-text-secondary font-black text-[10px] uppercase tracking-[0.3em] mb-6">{t('trial.emailUsageLabel')}</h4>
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className={cn("text-5xl font-black tracking-tighter", emailAtLimit ? "text-red-400" : "text-[#2ecc71]")}>{emailsUsed}</span>
                            <span className="text-text-secondary font-bold text-lg">/ 30</span>
                          </div>
                          <div className="w-full bg-border-subtle/40 rounded-full h-2 mb-3">
                            <div
                              className={cn("h-2 rounded-full transition-all", emailAtLimit ? "bg-red-400" : "bg-[#2ecc71]")}
                              style={{ width: `${Math.min((emailsUsed / 30) * 100, 100)}%` }}
                            />
                          </div>
                          <p className="text-text-secondary text-xs">{emailsUsed} {t('trial.emailsUsed')}</p>
                          {emailAtLimit && (
                            <div className="mt-4 pt-4 border-t border-border-subtle flex justify-start">
                              <ContactAdminButton label={t('trial.contactAdmin')} subject="Sentinel - Ampliar límite de emails" />
                            </div>
                          )}
                        </div>
                        <div className="bg-bg-card border border-border-subtle rounded-[3rem] p-10">
                          <h4 className="text-[#2ecc71] font-black text-[10px] uppercase tracking-[0.3em] mb-4">{t('trial.planBadge')}</h4>
                          <p className="text-text-secondary text-xs leading-relaxed">{t('trial.retentionNote')}</p>
                        </div>
                      </div>
                    </div>
                  )
                )}

                {activeTab === 'system' && (
                  <div className="grid grid-cols-12 gap-8 pb-10">
                    <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-bg-card border border-border-subtle rounded-[3rem] p-10">
                      <h4 className="text-text-secondary font-black text-[10px] uppercase tracking-[0.3em] mb-6">{t('settings.pollingFreq')}</h4>
                      <div className="flex items-baseline gap-4 mb-4">
                        <input
                          type="number"
                          defaultValue={config.system.default_check_interval}
                          onBlur={(e) => handleConfigUpdate('system', { default_check_interval: parseInt(e.target.value) })}
                          className="bg-transparent text-6xl font-black text-[#2ecc71] w-32 focus:outline-none"
                        />
                        <span className="text-text-secondary font-bold text-xl uppercase">{t('settings.seg')}</span>
                      </div>
                      <p className="text-text-secondary text-xs leading-relaxed border-t border-border-subtle pt-6">{t('settings.pollingDesc')}</p>
                    </div>

                    <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-bg-card border border-border-subtle rounded-[3rem] p-10">
                      <h4 className="text-text-secondary font-black text-[10px] uppercase tracking-[0.3em] mb-6">{t('settings.dataRetention')}</h4>
                      <div className="flex items-baseline gap-4 mb-4">
                        <input
                          type="number"
                          defaultValue={config.system.log_retention_days}
                          onBlur={(e) => handleConfigUpdate('system', { log_retention_days: parseInt(e.target.value) })}
                          className="bg-transparent text-6xl font-black text-[#2ecc71] w-32 focus:outline-none"
                        />
                        <span className="text-text-secondary font-bold text-xl uppercase">{t('settings.days')}</span>
                      </div>
                      <p className="text-text-secondary text-xs leading-relaxed border-t border-border-subtle pt-6">{t('settings.retentionDesc')}</p>
                    </div>

                    <div className={cn(
                      "col-span-12 lg:col-span-4 rounded-[3rem] p-10 border transition-all duration-500",
                      config.system.maintenance_mode ? "bg-red-500 text-white border-red-600" : "bg-bg-card border-border-subtle"
                    )}>
                      <h4 className={cn("font-black text-[10px] uppercase tracking-[0.3em] mb-6", config.system.maintenance_mode ? "text-white/80" : "text-text-secondary")}>{t('settings.maintenanceMode')}</h4>
                      <h3 className="text-3xl font-black mb-4 tracking-tighter">{t('settings.offline')}</h3>
                      <p className={cn("text-xs leading-relaxed mb-8", config.system.maintenance_mode ? "text-white/70" : "text-text-secondary")}>{t('settings.maintenanceDesc')}</p>
                      <button 
                        onClick={() => handleConfigUpdate('system', { maintenance_mode: !config.system.maintenance_mode })}
                        className={cn(
                          "w-full h-12 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all",
                          config.system.maintenance_mode ? "bg-white text-red-500 shadow-2xl" : "bg-red-500/10 text-red-500 border border-red-500/20"
                        )}
                      >
                        {config.system.maintenance_mode ? t('settings.deactivateMode') : t('settings.activateMode')}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'security' && (
                  <div className="grid grid-cols-12 gap-8 pb-10">
                    <div className="col-span-12 lg:col-span-6 bg-bg-card border border-border-subtle rounded-[3rem] p-12">
                      <div className="mb-10">
                        <span className="bg-red-500/10 text-red-500 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">{t('settings.hardening')}</span>
                        <h3 className="text-text-primary font-black text-4xl mt-6 tracking-tighter uppercase">{t('settings.hardeningTitle')}</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">{t('settings.maxAttempts')}</label>
                        <div className="flex items-center gap-4">
                          <input
                            type="number"
                            defaultValue={config.security.max_login_attempts}
                            onBlur={(e) => handleConfigUpdate('security', { max_login_attempts: parseInt(e.target.value) })}
                            className="w-32 bg-bg-main/50 border border-border-subtle rounded-3xl px-8 py-5 text-4xl font-black text-red-500 focus:outline-none focus:border-red-500 transition-all"
                          />
                        </div>
                        <p className="text-text-secondary text-xs">{t('settings.maxAttemptsDesc')}</p>
                      </div>
                    </div>

                    <div className="col-span-12 lg:col-span-6 bg-text-primary rounded-[3rem] p-12 text-bg-card flex flex-col justify-between">
                      <div>
                        <h4 className="text-bg-card/50 font-black text-[10px] uppercase tracking-[0.3em] mb-4">{t('settings.accessPolicies')}</h4>
                        <h3 className="text-3xl font-black tracking-tight mb-4">{t('settings.bruteForce')}</h3>
                        <p className="text-bg-card/70 text-sm leading-relaxed">
                          {t('settings.bruteForceDesc')}
                        </p>
                      </div>
                      <div className="mt-8 flex items-center gap-3">
                        <div className="h-2 w-2 bg-[#2ecc71] rounded-full animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#2ecc71]">{t('settings.activeProtection')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
