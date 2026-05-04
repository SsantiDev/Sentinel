import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout({ children }) {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-bg-main text-text-primary transition-colors duration-300 overflow-hidden">
      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto custom-scrollbar pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="p-6 md:p-8 w-full max-w-[100vw]"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
