import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportRows, exportSummary, printHtml, HEADERS } from './consumosExport.js'

const func = {nome:'Ana <Silva>', numero:'169', data:'2026-10-29', tipo:'A', pratoNum:1, pratoLabel:'Carne', quantidade:1, ts:'2026-10-29T12:30:00'}
const vis  = {data:'2026-10-28', tipo:'J', pratoNum:3, pratoLabel:null, quantidade:4, ts:'2026-10-28T19:05:00'}

test('exportRows: funcionário e visitante, mesma ordem da tabela', () => {
  const [a, b] = exportRows([func, vis])
  assert.deepEqual(a.slice(0, 6), ['169', 'Ana <Silva>', '29/10/2026', 'Almoço', 'Carne', 1])
  assert.deepEqual(b.slice(0, 6), ['', 'Visitante(s)', '28/10/2026', 'Jantar', 'Prato 3', 4])
  assert.equal(a.length, HEADERS.length)
})

test('exportRows: coluna Estado distingue consumo automático (não consumido)', () => {
  const [a, b, c] = exportRows([func, {...func, automatico:true}, vis])
  assert.deepEqual([a.at(-1), b.at(-1), c.at(-1)], ['Consumido', 'Não consumido', 'Consumido'])
})

test('exportSummary: período, refeição, estado e totais; datas vazias não rebentam', () => {
  const stats = {total:5, a:1, j:4, funcionarios:1, visitantes:4, naoConsumidos:2}
  const s = exportSummary({fStart:'2026-10-01', fEnd:'2026-10-31', fMeal:'J', fEstado:'N', stats})
  assert.deepEqual(s.slice(0, 2), ['Período: 01/10/2026 a 31/10/2026', 'Refeição: Jantar · Estado: Não consumidos'])
  assert.match(s[2], /2 não consumidos$/)
  assert.match(exportSummary({fStart:'', fEnd:'', fMeal:'', fEstado:'', stats})[0], /…/)
})

test('printHtml: escapa HTML dos nomes e inclui todas as linhas', () => {
  const html = printHtml(exportRows([func, vis]), ['x'])
  assert.ok(html.includes('Ana &lt;Silva&gt;') && !html.includes('<Silva>'))
  assert.equal((html.match(/<tr>/g) || []).length, 3) // cabeçalho + 2
})
