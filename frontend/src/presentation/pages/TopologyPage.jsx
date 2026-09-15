import { useState } from 'react'
import { Plus, Share2 } from 'lucide-react'
import { useServiceGraph } from '../../application/hooks/useServiceGraph'
import { TopologyGraph } from '../components/TopologyGraph'

export function TopologyPage() {
  const { nodes, edges, loading, error, addDependency, removeDependency } = useServiceGraph()
  const [serviceId, setServiceId] = useState('')
  const [dependsOnId, setDependsOnId] = useState('')
  const [formError, setFormError] = useState(null)

  const handleAddDependency = async (e) => {
    e.preventDefault()
    setFormError(null)
    try {
      await addDependency(Number(serviceId), Number(dependsOnId))
      setServiceId('')
      setDependsOnId('')
    } catch (err) {
      setFormError(err.response?.data?.error || 'No se pudo crear la dependencia')
    }
  }

  if (loading) {
    return <div className="w-full py-20 text-center text-text-secondary animate-pulse">Cargando topologia...</div>
  }

  return (
    <div className="w-full space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Share2 className="text-[#2ecc71]" size={20} />
        <h1 className="text-xl font-black text-text-primary">Topologia de Servicios</h1>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleAddDependency} className="bg-bg-card border border-border-subtle rounded-2xl p-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Servicio</label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            required
            className="bg-bg-main border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary"
          >
            <option value="" disabled>Selecciona...</option>
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </div>

        <span className="text-text-secondary text-xs pb-2">depende de</span>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Servicio</label>
          <select
            value={dependsOnId}
            onChange={(e) => setDependsOnId(e.target.value)}
            required
            className="bg-bg-main border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary"
          >
            <option value="" disabled>Selecciona...</option>
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </div>

        <button
          type="submit"
          className="flex items-center gap-2 bg-[#2ecc71] text-[#0f0f1a] font-bold px-4 py-2 rounded-xl hover:bg-[#27ae60] transition-all text-sm"
        >
          <Plus size={16} /> Agregar
        </button>

        {formError && <p className="w-full text-red-400 text-xs">{formError}</p>}
      </form>

      <div className="bg-bg-card border border-border-subtle rounded-[2rem] p-8">
        <TopologyGraph nodes={nodes} edges={edges} onRemoveEdge={removeDependency} />
        {edges.length === 0 && nodes.length > 0 && (
          <p className="text-center text-text-secondary text-sm mt-4">
            Conecta tus servicios para ver el impacto en cascada cuando uno se cae.
          </p>
        )}
      </div>
    </div>
  )
}
