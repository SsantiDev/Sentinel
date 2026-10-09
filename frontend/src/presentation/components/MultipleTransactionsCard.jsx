import { Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const nf = new Intl.NumberFormat('es-CO')

// Hace visible el concepto base del sistema: cada anomalia es una rafaga de
// multiples transacciones dentro de una ventana. Muestra cuantos casos existen
// y cuantas transacciones estan agrupadas en ellos.
export function MultipleTransactionsCard({ stats }) {
  const { t } = useTranslation()
  // Solo rafagas: esta tarjeta es sobre "multiples transacciones", no incluye
  // los rechazos (duplicados/invalidos) agrupados.
  const cases = stats.burst_anomalies || 0
  const grouped = stats.anomalies_transaction_total || 0

  return (
    <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-widest">
          {t('anomalies.multipleTransactions')}
        </h3>
        <Layers className="text-violet-500" size={18} />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-3xl font-black text-text-primary tracking-tighter tabular-nums">
            {nf.format(cases)}
          </p>
          <p className="text-[10px] text-text-secondary mt-1 font-medium uppercase tracking-wider">
            {t('anomalies.caseCountSuffix')}
          </p>
        </div>
        <div>
          <p className="text-3xl font-black text-text-primary tracking-tighter tabular-nums">
            {nf.format(grouped)}
          </p>
          <p className="text-[10px] text-text-secondary mt-1 font-medium uppercase tracking-wider">
            {t('anomalies.groupedTransactions')}
          </p>
        </div>
      </div>
    </div>
  )
}
