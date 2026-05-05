import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Layers } from 'lucide-react'
import { useServices } from '../../application/hooks/useServices'
import { ServiceCard } from '../components/ServiceCard'
import { CreateServiceModal } from '../components/CreateServiceModal'
import { SummaryCards } from '../components/SummaryCards'
import { SkeletonCard, SkeletonSummary } from '../components/SkeletonCard'

export function DashboardPage() {
  const { services, loading, error, refetch, silentRefetch, toggleService } = useServices()
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const id = setInterval(silentRefetch, 30000)
    return () => clearInterval(id)
  }, [silentRefetch])

  const filteredServices = services
    .filter(s => 
      s.name.toLowerCase().includes(search.toLowerCase()) || 
      s.url.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.status === 'down' && b.status !== 'down') return -1
      if (a.status !== 'down' && b.status === 'down') return 1
      return 0
    })

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-6 mb-10">
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-[#2ecc71] transition-colors" size={18} />
            <input
              type="text"
              placeholder="Filtrar servicios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-bg-card border border-border-subtle text-text-primary pl-10 pr-4 py-2.5 rounded-xl w-full md:w-64 focus:outline-none focus:border-[#2ecc71] transition-all shadow-sm"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#2ecc71] text-[#0f0f1a] font-bold px-5 py-2.5 rounded-xl hover:bg-[#27ae60] hover:scale-105 active:scale-95 transition-all shadow-lg shadow-green-500/10 whitespace-nowrap"
          >
            <Plus size={20} />
            Nuevo
          </button>
        </div>
      </div>

      {loading ? <SkeletonSummary /> : <SummaryCards services={services} />}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-8 flex items-center gap-4 text-red-400">
          <div className="bg-red-500/20 p-2 rounded-lg">!</div>
          <p className="font-medium">{error}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          [...Array(8)].map((_, i) => <SkeletonCard key={i} />)
        ) : filteredServices.length > 0 ? (
          filteredServices.map((s, idx) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <ServiceCard service={s} onToggle={toggleService} />
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center bg-bg-card/50 rounded-[40px] border-2 border-dashed border-border-subtle">
            <Layers size={48} className="text-text-secondary mb-4 opacity-20" />
            <p className="text-text-secondary font-bold text-lg">No se encontraron servicios</p>
            <p className="text-text-secondary text-sm mt-1 opacity-60">Intenta con otra búsqueda o crea uno nuevo</p>
          </div>
        )}
      </div>

      {showModal && <CreateServiceModal onClose={() => setShowModal(false)} onSuccess={refetch} />}
    </div>
  )
}
