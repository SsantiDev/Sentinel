import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

// Modal reutilizable: lista completa en "ver mas" y detalle al hacer clic en
// un contenedor. Cabecera fija (con titulo y subtitulo opcional) y cuerpo con
// scroll propio.
export function ListModal({ open, title, subtitle, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="relative w-full max-w-lg z-10 max-h-[82vh] flex flex-col bg-bg-card border border-border-subtle rounded-3xl shadow-[0_40px_80px_rgba(0,0,0,0.3)] overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 px-7 pt-6 pb-4 border-b border-border-subtle">
              <div className="min-w-0">
                <h3 className="text-base font-black text-text-primary tracking-tight truncate">{title}</h3>
                {subtitle && (
                  <p className="text-[11px] text-text-secondary font-medium uppercase tracking-widest mt-1">{subtitle}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="shrink-0 text-text-secondary hover:text-text-primary p-2 -mr-2 -mt-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-200 hover:scale-110 hover:rotate-90 active:scale-90"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-7 py-6 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
