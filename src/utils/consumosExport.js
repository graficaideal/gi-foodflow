import { fmtHM } from './date.js'

export const HEADERS = ['Nº', 'Nome', 'Data', 'Refeição', 'Prato', 'Qtd', 'Hora', 'Estado']

const dmy = s => s.split('-').reverse().join('/')
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Linhas tal como aparecem na tabela de Consumos (já filtradas e ordenadas)
export const exportRows = sorted => sorted.map(c => [
  c.nome ? c.numero : '',
  c.nome || 'Visitante(s)',
  dmy(c.data),
  c.tipo === 'A' ? 'Almoço' : 'Jantar',
  c.pratoLabel || `Prato ${c.pratoNum}`,
  c.quantidade,
  fmtHM(c.ts),
  c.automatico ? 'Não consumido' : 'Consumido',
])

// Linha de contexto: período, refeição e totais
export const exportSummary = ({fStart, fEnd, fMeal, fEstado, stats}) => [
  `Período: ${fStart ? dmy(fStart) : '…'} a ${fEnd ? dmy(fEnd) : '…'}`,
  `Refeição: ${fMeal === 'A' ? 'Almoço' : fMeal === 'J' ? 'Jantar' : 'Todas'} · Estado: ${fEstado === 'C' ? 'Consumidos' : fEstado === 'N' ? 'Não consumidos' : 'Todos'}`,
  `${stats.total} consumos · ${stats.a} almoços · ${stats.j} jantares · ${stats.funcionarios} funcionários · ${stats.visitantes} visitantes · ${stats.naoConsumidos} não consumidos`,
]

export const printHtml = (rows, summary) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Consumos</title><style>
  @page { size: A4; margin: 14mm; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 11px; color: #000; margin: 0; }
  h1 { font-size: 16px; margin: 0 0 6px; }
  .meta { color: #444; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1.5px solid #000; padding: 4px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid #ddd; }
  td.n { text-align: right; } th.n { text-align: right; }
  tr { break-inside: avoid; }
</style></head><body>
  <h1>FoodFlow · Consumos</h1>
  ${summary.map(s => `<div class="meta">${esc(s)}</div>`).join('')}
  <table>
    <thead><tr>${HEADERS.map((h, i) => `<th${i === 5 ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((v, i) => `<td${i === 5 ? ' class="n"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
</body></html>`
