// Deteccion de picos repentinos en una serie temporal de anomalias.
//
// Un "pico" es un dia cuyo numero de anomalias se dispara frente al resto:
// supera el promedio mas una desviacion estandar, esta por encima de un
// minimo (para no marcar ruido de volumenes bajos) y es mayor que el dia
// anterior (salto brusco). El calculo es puro y determinista.

const STD_FACTOR = 1 // cuantas desviaciones por encima del promedio = pico
const MIN_COUNT = 3 // piso: por debajo de esto no se considera pico

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function stdDev(values, avg) {
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * @param {Array<{date: string, anomalies: number}>} series
 * @returns {Set<string>} fechas (ISO) marcadas como pico
 */
export function detectSpikes(series) {
  if (!series || series.length < 2) return new Set()

  const counts = series.map((point) => point.anomalies)
  const avg = mean(counts)
  const threshold = avg + STD_FACTOR * stdDev(counts, avg)

  const spikes = new Set()
  series.forEach((point, index) => {
    const previous = index > 0 ? counts[index - 1] : 0
    const isSpike =
      point.anomalies >= MIN_COUNT &&
      point.anomalies > threshold &&
      point.anomalies > previous
    if (isSpike) spikes.add(point.date)
  })
  return spikes
}
