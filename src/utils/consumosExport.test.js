import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportRows, exportSummary, printHtml, HEADERS } from './consumosExport.js'

const c = (numero, nome, tipo, extra = {}) => ({numero, nome, tipo, quantidade:1, ...extra})
const vis = (tipo, quantidade) => ({tipo, quantidade})

test('exportRows: agrupa por funcionário, ordena por Nº numérico, visitantes e TOTAL no fim', () => {
  const rows = exportRows([
    c('169', 'Bruno', 'A'), c('12', 'Ana', 'J'), c('169', 'Bruno', 'J', {automatico:true}),
    c('12', 'Ana', 'A'), c('12', 'Ana', 'A'), vis('J', 4), vis('A', 2),
  ])
  assert.deepEqual(rows, [
    ['12',  'Ana',        2, 1, 3],
    ['169', 'Bruno',      1, 1, 2],
    ['',    'Visitantes', 2, 4, 6],
    ['',    'TOTAL',      5, 6, 11],
  ])
  assert.equal(rows[0].length, HEADERS.length)
})

test('exportRows: sem visitantes não cria a linha; vazio dá só TOTAL a zeros', () => {
  assert.deepEqual(exportRows([c('5', 'Rui', 'A')]).map(r => r[1]), ['Rui', 'TOTAL'])
  assert.deepEqual(exportRows([]), [['', 'TOTAL', 0, 0, 0]])
})

test('exportSummary: período, refeição, estado e totais; datas vazias não rebentam', () => {
  const stats = {total:5, a:1, j:4, funcionarios:1, visitantes:4, naoConsumidos:2}
  const s = exportSummary({fStart:'2026-10-01', fEnd:'2026-10-31', fMeal:'J', fEstado:'N', stats})
  assert.deepEqual(s.slice(0, 2), ['Período: 01/10/2026 a 31/10/2026', 'Refeição: Jantar · Estado: Não consumidos'])
  assert.doesNotMatch(s[2], /não consumidos/)
  assert.match(exportSummary({fStart:'', fEnd:'', fMeal:'', fEstado:'', stats})[0], /…/)
})

test('printHtml: escapa HTML dos nomes e destaca a linha TOTAL', () => {
  const html = printHtml(exportRows([c('1', 'Ana <Silva>', 'A')]), ['x'])
  assert.ok(html.includes('Ana &lt;Silva&gt;') && !html.includes('<Silva>'))
  assert.equal((html.match(/<tr class="total">/g) || []).length, 1)
})
