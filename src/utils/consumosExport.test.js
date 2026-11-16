import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agruparPorFuncionario, exportRows, exportSummary, printHtml, HEADERS } from './consumosExport.js'

const c = (numero, nome, tipo, extra = {}) => ({numero, nome, tipo, quantidade:1, ...extra})
const vis = (tipo, quantidade) => ({tipo, quantidade})

test('agruparPorFuncionario: ordena por Nº numérico, visitantes no fim, total soma quantidades e mantém a ordem dos registos', () => {
  const grupos = agruparPorFuncionario([
    c('169', 'Bruno', 'A', {key:'b1'}), vis('J', 4), c('12', 'Ana', 'J', {key:'a1'}), c('169', 'Bruno', 'J', {key:'b2', automatico:true}), vis('A', 2),
  ])
  assert.deepEqual(grupos.map(g => [g.key, g.nome, g.total]), [['12', 'Ana', 1], ['169', 'Bruno', 2], ['visitantes', undefined, 6]])
  assert.deepEqual(grupos[1].itens.map(i => i.key), ['b1', 'b2'])
  assert.deepEqual(grupos.map(g => g.naoConsumidos), [0, 1, 0])
})

test('agruparPorFuncionario: sem registos não há grupos', () => {
  assert.deepEqual(agruparPorFuncionario([]), [])
})

test('exportRows: agrupa por funcionário, ordena por Nº numérico, visitantes e TOTAL no fim', () => {
  const rows = exportRows([
    c('169', 'Bruno', 'A'), c('12', 'Ana', 'J'), c('169', 'Bruno', 'J', {automatico:true}),
    c('12', 'Ana', 'A'), c('12', 'Ana', 'A'), vis('J', 4), vis('A', 2),
  ])
  assert.deepEqual(rows, [
    ['12',  'Ana',        2, 1, 3, ''],
    ['169', 'Bruno',      1, 1, 2, ''],
    ['',    'Visitantes', 2, 4, 6, ''],
    ['',    'TOTAL',      5, 6, 11, ''],
  ])
  assert.equal(rows[0].length, HEADERS.length)
})

test('exportRows: sem visitantes não cria a linha; vazio dá só TOTAL a zeros', () => {
  assert.deepEqual(exportRows([c('5', 'Rui', 'A')]).map(r => r[1]), ['Rui', 'TOTAL'])
  assert.deepEqual(exportRows([]), [['', 'TOTAL', 0, 0, 0, '']])
})

test('exportRows: com preços, valor por linha ao preço do dia de cada refeição e TOTAL', () => {
  const precos = [{desde:'2026-10-01', valor:'5.00'}, {desde:'2026-11-01', valor:'5.50'}]
  const rows = exportRows([
    c('12', 'Ana', 'A', {data:'2026-10-30'}), c('12', 'Ana', 'J', {data:'2026-11-02', automatico:true}),
    vis('A', 2), c('7', 'Rui', 'A', {data:'2026-09-30'}),
  ].map((x, i) => i === 2 ? {...x, data:'2026-11-03'} : x), precos)
  assert.deepEqual(rows.map(r => [r[1], r[5]]), [['Rui', 0], ['Ana', 10.5], ['Visitantes', 11], ['TOTAL', 21.5]])   // Rui: antes do 1.º preço
})

test('exportSummary: linha do valor só com preços, com aviso das refeições sem preço', () => {
  const stats = {total:3, a:3, j:0, funcionarios:1, visitantes:0}
  assert.equal(exportSummary({fStart:'', fEnd:'', fMeal:'', fEstado:'', stats}).length, 3)
  assert.match(exportSummary({fStart:'', fEnd:'', fMeal:'', fEstado:'', stats:{...stats, valor:16.5, semPreco:0}})[3], /^Valor a faturar: 16,50\s€$/)
  assert.match(exportSummary({fStart:'', fEnd:'', fMeal:'', fEstado:'', stats:{...stats, valor:5, semPreco:2}})[3], /2 refeições sem preço/)
})

test('printHtml: valor formatado em euros', () => {
  assert.match(printHtml(exportRows([c('1', 'Ana', 'A', {data:'2026-11-02'})], [{desde:'2026-11-01', valor:'5.50'}]), []), /5,50\s€/)
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

test('exportSummary: indica a pesquisa quando há texto', () => {
  const stats = {total:0, a:0, j:0, funcionarios:0, visitantes:0}
  assert.match(exportSummary({fStart:'', fEnd:'', fMeal:'', fEstado:'', q:' joao ', stats})[1], / · Pesquisa: "joao"$/)
  assert.doesNotMatch(exportSummary({fStart:'', fEnd:'', fMeal:'', fEstado:'', q:'', stats})[1], /Pesquisa/)
})
