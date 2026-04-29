import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useServices } from '../../application/hooks/useServices'
import { useAuth } from '../../application/hooks/useAuth'
import { ServiceCard } from '../components/ServiceCard'
import { CreateServiceModal } from '../components/CreateServiceModal'
import { SummaryCards } from '../components/SummaryCards'

export function DashboardPage() {
  const { services, loading, error, refetch, silentRefetch } = useServices()
  const { logout } = useAuth()
  const navigate = useNavigate()
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

  const up = services.filter((s) => s.status === 'up').length
  const down = services.filter((s) => s.status === 'down').length

  return (
    <div className="min-h-screen bg-[#0f0f1a]">
      <header className="border-b border-[#2a2a3e] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-white font-bold text-xl">Sentinel</h1>
          <div className="flex gap-4 text-sm">
            <span className="text-gray-400">{services.length} servicios</span>
            <span className="text-green-400">{up} UP</span>
            <span className="text-red-400">{down} DOWN</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#2ecc71] text-[#0f0f1a] font-bold px-4 py-2 rounded-lg hover:bg-[#27ae60] transition-colors text-sm"
          >
            + Nuevo Servicio
          </button>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="p-6">
        {loading && <p className="text-gray-400">Cargando...</p>}
        {error && <p className="text-red-400">{error}</p>}
        
        {!loading && <SummaryCards services={services} />}

        <div className="flex mb-6">
          <input
            type="text"
            placeholder="Buscar por nombre o URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#1a1a2e] border border-[#2a2a3e] text-white px-4 py-2 rounded-lg w-full max-w-md focus:outline-none focus:border-[#2ecc71] transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredServices.map((s) => <ServiceCard key={s.id} service={s} />)}
        </div>
      </main>
      {showModal && <CreateServiceModal onClose={() => setShowModal(false)} onSuccess={refetch} />}
    </div>
  )
}
