import { addD } from './date.js'
import { SLOT4_LABELS } from '../constants/pratos.js'

export const DEFAULT_LABELS = ['Carne', 'Peixe', 'Dieta']   // slots 1–3, só quando não há nenhuma ementa desse tipo

// Segunda-feira da semana visível; ao fim de semana salta para a seguinte (igual às Marcações)
export const week0 = today => {
  const wd = new Date(today + 'T12:00:00').getDay()
  return addD(today, wd === 0 ? 1 : wd === 6 ? 2 : 1 - wd)
}

// Sempre segunda a sexta
export const weekDays = (today, offset) => Array.from({ length: 5 }, (_, i) => addD(week0(today), offset * 7 + i))

export const isoWeekNum = dateStr => {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const y = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d - y) / 86400000) + 1) / 7)
}

// Valor mais frequente (ignora vazios); em empate ganha o primeiro
export const mostFrequent = vals => {
  const count = new Map()
  for (const v of vals) if (v) count.set(v, (count.get(v) || 0) + 1)
  let best = null
  for (const [v, c] of count) if (best === null || c > count.get(best)) best = v
  return best
}

// Labels dos slots 1–3 mostradas na 1.ª coluna para um tipo (A/J).
// weekRows: ementas da semana desse tipo, ordenadas por data; allRows: todas as ementas desse tipo.
export const slotLabels = (weekRows, isPast, allRows) => {
  const open = weekRows.filter(e => !isPast(e.data))
  const latest = [...allRows].sort((a, b) => b.data.localeCompare(a.data))[0]
  return [1, 2, 3].map(n => {
    const k = `prato${n}_label`
    return mostFrequent(open.map(e => e[k])) ?? mostFrequent(weekRows.map(e => e[k])) ?? latest?.[k] ?? DEFAULT_LABELS[n - 1]
  })
}

export const newEmentaRow = (data, tipo, labels) => ({
  data, tipo,
  prato1_label: labels[0], prato1_desc: null,
  prato2_label: labels[1], prato2_desc: null,
  prato3_label: labels[2], prato3_desc: null,
  prato4_label: SLOT4_LABELS[0], prato4_desc: null,
})
