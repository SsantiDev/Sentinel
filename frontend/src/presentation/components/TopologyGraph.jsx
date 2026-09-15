import { X } from 'lucide-react'

const VIEWBOX_SIZE = 480
const CENTER = VIEWBOX_SIZE / 2
const RADIUS = 180
const NODE_RADIUS = 28

const STATUS_COLORS = {
  gray: { fill: '#374151', stroke: '#6b7280', text: '#9ca3af' },
  green: { fill: 'rgba(46,204,113,0.15)', stroke: '#2ecc71', text: '#2ecc71' },
  red: { fill: 'rgba(239,68,68,0.15)', stroke: '#ef4444', text: '#ef4444' },
  yellow: { fill: 'rgba(234,179,8,0.15)', stroke: '#eab308', text: '#eab308' },
}

function colorFor(node) {
  if (!node.is_active) return 'gray'
  if (node.status === 'down') return 'red'
  if (node.impacted) return 'yellow'
  return 'green'
}

// Reparte los servicios en circulo (como las horas de un reloj) y devuelve
// un mapa: id del servicio -> su posicion {x, y} en el dibujo.
function circularPositions(nodes) {
  const count = nodes.length
  return nodes.reduce((acc, node, index) => {
    const angle = (2 * Math.PI * index) / count - Math.PI / 2
    acc[node.id] = {
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
    }
    return acc
  }, {})
}

export function TopologyGraph({ nodes, edges, onRemoveEdge }) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
        <p className="font-bold">No hay servicios para mostrar</p>
      </div>
    )
  }

  const positions = circularPositions(nodes) // mapa: id de servicio -> {x, y} donde dibujarlo

  return (
    <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} className="w-full max-w-2xl mx-auto">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const from = positions[edge.service]
        const to = positions[edge.depends_on]
        if (!from || !to) return null
        const midX = (from.x + to.x) / 2
        const midY = (from.y + to.y) / 2

        return (
          <g key={edge.id} className="text-text-secondary">
            <line
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="currentColor" strokeWidth="1.5" markerEnd="url(#arrow)"
              opacity="0.5"
            />
            {onRemoveEdge && (
              <g
                transform={`translate(${midX}, ${midY})`}
                className="cursor-pointer"
                onClick={() => onRemoveEdge(edge.id)}
              >
                <circle r="8" fill="#1a1a2e" stroke="currentColor" strokeWidth="1" opacity="0.8" />
                <X x="-4" y="-4" size={8} color="currentColor" />
              </g>
            )}
          </g>
        )
      })}

      {nodes.map((node) => {
        const pos = positions[node.id]
        const color = STATUS_COLORS[colorFor(node)]
        return (
          <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
            <title>{`${node.name} — ${node.status}${node.impacted ? ' (impactado)' : ''}`}</title>
            <circle r={NODE_RADIUS} fill={color.fill} stroke={color.stroke} strokeWidth="2" />
            <text
              textAnchor="middle" dy="4"
              fontSize="10" fontWeight="bold" fill={color.text}
            >
              {node.name.slice(0, 8)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
