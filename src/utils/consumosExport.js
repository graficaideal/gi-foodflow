export const HEADERS = ['Nº', 'Nome', 'Almoços', 'Jantares', 'Total']
const NUM = 2   // colunas a partir desta são numéricas

const dmy = s => s.split('-').reverse().join('/')
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Agrupa as linhas visíveis (já filtradas) por funcionário: almoços, jantares e total.
// Visitantes numa linha própria e TOTAL no fim (sempre a última linha).
export const exportRows = sorted => {
  const by = new Map(), vis = {a:0, j:0}
  for (const c of sorted) {
    const k = c.tipo === 'A' ? 'a' : 'j'
    if (!c.nome) { vis[k] += c.quantidade; continue }
    const g = by.get(c.numero) || {numero:c.numero, nome:c.nome, a:0, j:0}
    g[k] += c.quantidade
    by.set(c.numero, g)
  }
  const rows = [...by.values()]
    .sort((x, y) => String(x.numero).localeCompare(String(y.numero), undefined, {numeric:true}))
    .map(g => [g.numero, g.nome, g.a, g.j, g.a + g.j])
  if (vis.a + vis.j) rows.push(['', 'Visitantes', vis.a, vis.j, vis.a + vis.j])
  const sum = i => rows.reduce((s, r) => s + r[i], 0)
  rows.push(['', 'TOTAL', sum(2), sum(3), sum(4)])
  return rows
}

// Linhas de contexto: período, filtros e totais
export const exportSummary = ({fStart, fEnd, fMeal, fEstado, stats}) => [
  `Período: ${fStart ? dmy(fStart) : '…'} a ${fEnd ? dmy(fEnd) : '…'}`,
  `Refeição: ${fMeal === 'A' ? 'Almoço' : fMeal === 'J' ? 'Jantar' : 'Todas'} · Estado: ${fEstado === 'C' ? 'Consumidos' : fEstado === 'N' ? 'Não consumidos' : 'Todos'}`,
  `${stats.total} consumos · ${stats.a} almoços · ${stats.j} jantares · ${stats.funcionarios} funcionários · ${stats.visitantes} visitantes`,
]

export const printHtml = (rows, summary) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Consumos</title><style>
  @page { size: A4; margin: 14mm; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 11px; color: #000; margin: 0; }
  h1 { font-size: 16px; margin: 0 0 6px; }
  .meta { color: #444; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1.5px solid #000; padding: 4px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid #ddd; }
  .n { text-align: right; }
  tr { break-inside: avoid; }
  tr.total td { font-weight: 700; border-top: 1.5px solid #000; border-bottom: none; }
</style></head><body>
  <h1>FoodFlow · Consumos por funcionário</h1>
  ${summary.map(s => `<div class="meta">${esc(s)}</div>`).join('')}
  <table>
    <thead><tr>${HEADERS.map((h, i) => `<th${i >= NUM ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, ri) => `<tr${ri === rows.length - 1 ? ' class="total"' : ''}>${r.map((v, i) => `<td${i >= NUM ? ' class="n"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
</body></html>`
