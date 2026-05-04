import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle, Info, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = '¿Confirmar acción?', 
  message = 'Esta operación no se puede deshacer.', 
  confirmText = 'Aceptar', 
  cancelText = 'Cancelar',
  variant = 'danger' // 'danger' | 'warning' | 'info' | 'success'
}) {
  const variants = {
    danger: {
      icon: <ShieldAlert className="text-red-400" size={32} />,
      color: 'rgba(239, 68, 68, 1)',
      shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
      border: 'border-red-500/30',
      glow: 'bg-red-500/20',
      btn: 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-[0_4px_15px_rgba(239,68,68,0.4)]'
    },
    warning: {
      icon: <AlertTriangle className="text-amber-400" size={32} />,
      color: 'rgba(245, 158, 11, 1)',
      shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
      border: 'border-amber-500/30',
      glow: 'bg-amber-500/20',
      btn: 'bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)]'
    },
    info: {
      icon: <Info className="text-blue-400" size={32} />,
      color: 'rgba(59, 130, 246, 1)',
      shadow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',
      border: 'border-blue-500/30',
      glow: 'bg-blue-500/20',
      btn: 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-[0_4px_15px_rgba(59,130,246,0.4)]'
    },
    success: {
      icon: <CheckCircle2 className="text-emerald-400" size={32} />,
      color: 'rgba(16, 185, 129, 1)',
      shadow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]',
      border: 'border-emerald-500/30',
      glow: 'bg-emerald-500/20',
      btn: 'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-[0_4px_15px_rgba(16,185,129,0.4)]'
    }
  }

  const style = variants[variant] || variants.danger

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          {/* Enhanced Backdrop with stronger blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />
          
          {/* Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 350 }}
            className="relative w-full max-w-[420px] z-10"
          >
            {/* Main Card */}
            <div className="bg-bg-card border border-border-subtle rounded-[2.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.3)] relative">

              {/* Close Button — outside overflow-hidden so it's never clipped */}
              <button
                onClick={onClose}
                className="absolute top-5 right-6 z-20 text-text-secondary hover:text-text-primary transition-all p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full"
              >
                <X size={18} />
              </button>

              <div className={`absolute top-[-80px] left-[-80px] w-48 h-48 rounded-full blur-[80px] opacity-15 ${style.glow} pointer-events-none`} />

              <div className="p-10 relative z-10">
                <div className="flex flex-col items-center text-center mb-8">
                  <motion.div
                    initial={{ rotate: -10, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    className={`p-5 rounded-[2rem] border ${style.border} ${style.glow} mb-6`}
                  >
                    {style.icon}
                  </motion.div>

                  <h3 className="text-text-primary text-2xl font-black tracking-tight mb-3 leading-tight">
                    {title}
                  </h3>

                  <p className="text-text-secondary text-sm leading-relaxed max-w-[280px]">
                    {message}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      onConfirm()
                      onClose()
                    }}
                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all relative overflow-hidden group ${style.btn}`}
                  >
                    <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-[-25deg] translate-x-[-150%] group-hover:translate-x-[250%] transition-transform duration-700 ease-in-out" />
                    <span className="relative z-10">{confirmText}</span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="w-full py-3 rounded-2xl font-semibold text-sm text-text-secondary border border-border-subtle hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-all uppercase tracking-widest"
                  >
                    {cancelText}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
