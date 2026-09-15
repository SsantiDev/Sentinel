import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, UserPlus, Trash2, Shield, User as UserIcon, Calendar, Clock, ChevronRight, ShieldAlert, Unlock, Globe, X, Save, Key, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import apiClient from '../../infrastructure/apiClient'
import { cn } from '../../infrastructure/utils'
import { SchedulerHealthCard } from '../components/SchedulerHealthCard'
import { useSchedulerStatus } from '../../application/hooks/useSchedulerStatus'

export function AdminUsersPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState([])
  const [blockedIps, setBlockedIps] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('users')
  const { status: schedulerStatus, loading: schedulerLoading } = useSchedulerStatus()
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    is_staff: false,
    is_superuser: false
  })
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersRes, ipsRes] = await Promise.all([
        apiClient.get('/users/'),
        apiClient.get('/blocked-ips/')
      ])
      setUsers(usersRes.data)
      setBlockedIps(ipsRes.data)
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (id) => {
    if (window.confirm(t('admin.deleteMessage'))) {
      try {
        await apiClient.delete(`/users/${id}/`)
        setUsers(users.filter(u => u.id !== id))
      } catch (error) {
        console.error('Error deleting user:', error)
      }
    }
  }

  const handleUnblockIp = async (id) => {
    if (window.confirm(t('admin.unblockMessage'))) {
      try {
        await apiClient.post(`/blocked-ips/${id}/unblock/`)
        setBlockedIps(blockedIps.map(ip => ip.id === id ? { ...ip, is_blocked: false } : ip))
      } catch (error) {
        console.error('Error unblocking IP:', error)
      }
    }
  }

  const openModal = (user = null) => {
    if (user) {
      setSelectedUser(user)
      setFormData({
        username: user.username,
        email: user.email || '',
        password: '',
        is_staff: user.is_staff,
        is_superuser: user.is_superuser
      })
    } else {
      setSelectedUser(null)
      setFormData({
        username: '',
        email: '',
        password: '',
        is_staff: false,
        is_superuser: false
      })
    }
    setIsModalOpen(true)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      const payload = { ...formData }
      if (!payload.password) delete payload.password

      if (selectedUser) {
        const { data } = await apiClient.patch(`/users/${selectedUser.id}/`, payload)
        setUsers(users.map(u => u.id === selectedUser.id ? data : u))
      } else {
        const { data } = await apiClient.post('/users/', payload)
        setUsers([data, ...users])
      }
      setIsModalOpen(false)
    } catch (error) {
      console.error('Error saving user:', error)
      alert(error.response?.data?.username || 'Error saving user')
    } finally {
      setFormLoading(false)
    }
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, staggerChildren: 0.05 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
  }

  return (
    <div className="w-full space-y-6 pb-12">
      <SchedulerHealthCard status={schedulerStatus} loading={schedulerLoading} />

      <div className="flex items-center justify-between gap-4 bg-bg-card/50 p-2 rounded-2xl border border-border-subtle backdrop-blur-sm">
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('users')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
              activeTab === 'users' ? "bg-text-primary text-bg-main" : "text-text-secondary hover:bg-border-subtle"
            )}
          >
            <Users size={14} />
            {t('admin.title')}
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
              activeTab === 'security' ? "bg-text-primary text-bg-main" : "text-text-secondary hover:bg-border-subtle"
            )}
          >
            <ShieldAlert size={14} />
            {t('admin.blockedIps')}
          </button>
        </div>

        {activeTab === 'users' && (
          <button 
            onClick={() => openModal()}
            className="bg-[#2ecc71] text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-[#2ecc71]/20"
          >
            <UserPlus size={14} />
            {t('admin.newUser')}
          </button>
        )}
      </div>

      <motion.div 
        key={activeTab}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="bg-bg-card border border-border-subtle rounded-[2rem] overflow-hidden shadow-2xl shadow-black/20"
      >
        <div className="overflow-x-auto">
          {activeTab === 'users' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-main/30">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">{t('admin.username')}</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">{t('admin.role')}</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">{t('admin.joined')}</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">{t('admin.lastLogin')}</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary text-right">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {loading ? (
                  <tr><td colSpan="5" className="px-8 py-20 text-center text-text-secondary animate-pulse text-[10px] font-black uppercase tracking-widest">Sincronizando Usuarios...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan="5" className="px-8 py-20 text-center text-text-secondary text-[10px] font-black uppercase tracking-widest italic opacity-50">No hay usuarios registrados</td></tr>
                ) : users.map((user) => (
                  <motion.tr key={user.id} variants={itemVariants} className="group hover:bg-bg-main/40 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-text-primary/5 flex items-center justify-center text-text-primary border border-border-subtle">
                          <UserIcon size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-text-primary tracking-tight text-sm">{user.username}</p>
                          <p className="text-[10px] text-text-secondary font-medium tracking-tight opacity-70">{user.email || 'system-user@sentinel.io'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {user.is_superuser ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-[9px] font-black uppercase tracking-wider border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                          <Shield size={10} /> {t('admin.superAdmin')}
                        </span>
                      ) : user.is_staff ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase tracking-wider border border-blue-500/20">
                          {t('admin.staff')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2ecc71]/10 text-[#2ecc71] text-[9px] font-black uppercase tracking-wider border border-[#2ecc71]/20">
                          {t('admin.user')}
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-text-secondary opacity-80">
                        <Calendar size={12} />
                        <span className="text-[11px] font-medium">{new Date(user.date_joined).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-text-secondary opacity-80">
                        <Clock size={12} />
                        <span className="text-[11px] font-medium">
                          {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.is_superuser}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            user.is_superuser 
                              ? "text-text-secondary/20 cursor-not-allowed" 
                              : "text-text-secondary hover:text-red-400 hover:bg-red-400/10"
                          )}
                        >
                          <Trash2 size={16} />
                        </button>
                        <button 
                          onClick={() => openModal(user)}
                          className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-main rounded-lg transition-all"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-main/30">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">{t('admin.ipAddress')}</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">{t('admin.attempts')}</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">{t('admin.blockedAt')}</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary text-right">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {loading ? (
                  <tr><td colSpan="5" className="px-8 py-20 text-center text-text-secondary animate-pulse text-[10px] font-black uppercase tracking-widest">Escaneando Cortafuegos...</td></tr>
                ) : blockedIps.length === 0 ? (
                  <tr><td colSpan="5" className="px-8 py-20 text-center text-text-secondary text-[10px] font-black uppercase tracking-widest italic opacity-50">{t('admin.noBlockedIps')}</td></tr>
                ) : blockedIps.map((ip) => (
                  <motion.tr key={ip.id} variants={itemVariants} className="group hover:bg-bg-main/40 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-text-primary/5 flex items-center justify-center text-text-primary border border-border-subtle">
                          <Globe size={16} />
                        </div>
                        <span className="font-mono font-bold text-text-primary text-sm tracking-tight">{ip.ip_address}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {ip.is_blocked ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-[9px] font-black uppercase tracking-wider border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                          BLOCKED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 text-[9px] font-black uppercase tracking-wider border border-orange-500/20">
                          MONITORING
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5 font-mono text-xs font-bold text-text-secondary">
                      {ip.attempts}
                    </td>
                    <td className="px-8 py-5 text-[11px] text-text-secondary font-medium">
                      {ip.blocked_at ? new Date(ip.blocked_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-8 py-5 text-right">
                      {ip.is_blocked && (
                        <button 
                          onClick={() => handleUnblockIp(ip.id)}
                          className="bg-text-primary text-bg-main px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2 ml-auto"
                        >
                          <Unlock size={12} />
                          {t('admin.unblock')}
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* User Edit/Create Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-bg-card border border-border-subtle rounded-[2.5rem] shadow-2xl z-[101] overflow-hidden"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-text-primary/5 flex items-center justify-center text-text-primary border border-border-subtle shadow-inner">
                      {selectedUser ? <UserIcon size={24} /> : <UserPlus size={24} />}
                    </div>
                    <div>
                      <h2 className="text-xl font-black tracking-tighter text-text-primary">
                        {selectedUser ? t('admin.editUser') : t('admin.newUser')}
                      </h2>
                      <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-50">
                        {selectedUser ? `ID: ${selectedUser.id}` : 'System Portal'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-3 text-text-secondary hover:text-text-primary hover:bg-bg-main rounded-2xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleFormSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    {/* Username */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">{t('admin.username')}</label>
                      <div className="relative group">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-text-primary transition-colors" size={18} />
                        <input 
                          type="text"
                          required
                          value={formData.username}
                          onChange={(e) => setFormData({...formData, username: e.target.value})}
                          className="w-full bg-bg-main border border-border-subtle rounded-2xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:border-text-primary/30 transition-all placeholder:text-text-secondary/30"
                          placeholder="johndoe"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Email</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-text-primary transition-colors" size={18} />
                        <input 
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full bg-bg-main border border-border-subtle rounded-2xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:border-text-primary/30 transition-all placeholder:text-text-secondary/30"
                          placeholder="john@sentinel.io"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">
                        {selectedUser ? 'New Password (Optional)' : 'Password'}
                      </label>
                      <div className="relative group">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-text-primary transition-colors" size={18} />
                        <input 
                          type="password"
                          required={!selectedUser}
                          value={formData.password}
                          onChange={(e) => setFormData({...formData, password: e.target.value})}
                          className="w-full bg-bg-main border border-border-subtle rounded-2xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:border-text-primary/30 transition-all placeholder:text-text-secondary/30"
                          placeholder="••••••••"
                        />
                      </div>
                      {selectedUser && <p className="text-[9px] text-text-secondary italic ml-1 opacity-60">Leave blank to keep current password</p>}
                    </div>

                    {/* Roles */}
                    <div className="flex gap-4 pt-2">
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, is_staff: !formData.is_staff})}
                        className={cn(
                          "flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                          formData.is_staff 
                            ? "bg-blue-500/10 border-blue-500/30 text-blue-400" 
                            : "bg-bg-main border-border-subtle text-text-secondary hover:border-text-secondary/30"
                        )}
                      >
                        <Shield size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Staff Access</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, is_superuser: !formData.is_superuser})}
                        className={cn(
                          "flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                          formData.is_superuser 
                            ? "bg-purple-500/10 border-purple-500/30 text-purple-400" 
                            : "bg-bg-main border-border-subtle text-text-secondary hover:border-text-secondary/30"
                        )}
                      >
                        <ShieldAlert size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">SuperAdmin</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-text-secondary hover:bg-bg-main transition-all"
                    >
                      {t('admin.cancel') || 'Cancel'}
                    </button>
                    <button 
                      type="submit"
                      disabled={formLoading}
                      className="flex-[2] bg-text-primary text-bg-main py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-text-primary/10 disabled:opacity-50"
                    >
                      {formLoading ? (
                        <div className="w-4 h-4 border-2 border-bg-main/30 border-t-bg-main rounded-full animate-spin" />
                      ) : (
                        <>
                          <Save size={16} />
                          {t('admin.save') || 'Save User'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
