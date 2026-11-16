import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumoHoje, proximosDias, diasSemEmenta, periodoMes, faturacao, variacao, consumosPorDia, topNaoConsumidos } from './dashboard.js'

const HOJE = '2026-11-16'   // segunda-feira
const ementas = [
  { id: 1, data: HOJE, tipo: 'A', prato1_label: 'Carne', prato2_label: 'Peixe', prato3_label: null, prato4_label: 'Vegetariano' },
  { id: 2, data: HOJE, tipo: 'J', prato1_label: 'Carne' },
  { id: 3, data: '2026-11-17', tipo: 'A', prato1_label: 'Carne' },
  { id: 4, data: '2026-11-18', tipo: 'J', prato1_label: 'Carne' },
  { id: 5, data: '2026-11-10', tipo: 'A', prato1_label: 'Carne' },
  { id: 6, data: '2026-10-10', tipo: 'A', prato1_label: 'Carne' },
]

test('resumoHoje: marcações por prato (só pratos com nome), validadas sem automáticos, por servir e visitantes', () => {
  const marc = [
    { funcionario_id: 'a', ementa_id: 1, prato_num: 1 }, { funcionario_id: 'b', ementa_id: 1, prato_num: 1 },
    { funcionario_id: 'c', ementa_id: 1, prato_num: 2 }, { funcionario_id: 'd', ementa_id: 3, prato_num: 1 },
  ]
  const cons = [{ funcionario_id: 'a', ementa_id: 1 }, { funcionario_id: 'x', ementa_id: 1 }, { funcionario_id: 'b', ementa_id: 1, automatico: true }]
  const [a, j] = resumoHoje(ementas, marc, cons, [{ ementa_id: 1, quantidade: 3 }], HOJE)
  assert.deepEqual(a.pratos.map(p => [p.label, p.marcadas]), [['Carne', 2], ['Peixe', 1], ['Vegetariano', 0]])
  assert.equal(a.marcadas, 3)
  assert.equal(a.validadas, 2)    // a e x (sem marcação); o automático não conta
  assert.equal(a.porServir, 1)    // c
  assert.equal(a.visitantes, 3)
  assert.equal(j.marcadas, 0)
})

test('resumoHoje: refeição sem ementa hoje devolve em null', () => {
  assert.deepEqual(resumoHoje([], [], [], [], HOJE), [{ tipo: 'A', em: null }, { tipo: 'J', em: null }])
})

test('proximosDias: só dias depois de hoje, sem encerrados, null quando não há essa refeição', () => {
  const marc = [{ ementa_id: 3 }, { ementa_id: 3 }, { ementa_id: 4 }]
  assert.deepEqual(proximosDias(ementas, marc, [], HOJE), [{ data: '2026-11-17', A: 2, J: null }, { data: '2026-11-18', A: null, J: 1 }])
  assert.deepEqual(proximosDias(ementas, marc, ['2026-11-17'], HOJE).map(d => d.data), ['2026-11-18'])
  assert.equal(proximosDias(ementas, marc, [], HOJE, 1).length, 1)
})

test('diasSemEmenta: dias úteis desta semana (de hoje) e da próxima, sem ementa e não encerrados', () => {
  assert.deepEqual(diasSemEmenta(ementas, ['2026-11-20'], HOJE),
    ['2026-11-19', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'])
})

test('periodoMes: mês atual até hoje e mesmo período do mês anterior, cortado no último dia', () => {
  assert.deepEqual(periodoMes(HOJE), ['2026-11-01', '2026-11-16'])
  assert.deepEqual(periodoMes(HOJE, -1), ['2026-10-01', '2026-10-16'])
  assert.deepEqual(periodoMes('2026-03-31', -1), ['2026-02-01', '2026-02-28'])
  assert.deepEqual(periodoMes('2026-01-15', -1), ['2025-12-01', '2025-12-15'])
})

test('faturacao: pela data da ementa, separa validadas, não consumidas e visitantes', () => {
  const cons = [{ ementa_id: 1 }, { ementa_id: 5, automatico: true }, { ementa_id: 6 }, { ementa_id: 99 }]
  assert.deepEqual(faturacao(cons, [{ ementa_id: 1, quantidade: 2 }, { ementa_id: 6, quantidade: 5 }], ementas, ['2026-11-01', HOJE]),
    { validadas: 1, naoConsumidas: 1, visitantes: 2, total: 4, valor: 0, semPreco: 4 })
})

test('faturacao: valor ao preço de cada dia, não consumidas e visitantes incluídos', () => {
  const cons = [{ ementa_id: 1 }, { ementa_id: 5, automatico: true }]
  const precos = [{ desde: '2026-11-01', valor: '5.00' }, { desde: '2026-11-15', valor: '6.00' }]
  const r = faturacao(cons, [{ ementa_id: 1, quantidade: 2 }], ementas, ['2026-11-01', HOJE], precos)
  assert.equal(r.valor, 23)      // dia 10: 1 × 5,00 · dia 16: (1 + 2 visitantes) × 6,00
  assert.equal(r.semPreco, 0)
})

test('variacao: percentagem inteira, null sem base', () => {
  assert.equal(variacao(108, 100), 8)
  assert.equal(variacao(90, 120), -25)
  assert.equal(variacao(5, 0), null)
})

test('consumosPorDia: últimos dias com registos, por ordem, visitantes contam como consumidas', () => {
  const cons = [{ ementa_id: 1 }, { ementa_id: 2, automatico: true }, { ementa_id: 5 }, { ementa_id: 6 }]
  assert.deepEqual(consumosPorDia(cons, [{ ementa_id: 5, quantidade: 4 }], ementas, HOJE), [
    { data: '2026-11-10', consumidas: 5, naoConsumidas: 0 },
    { data: HOJE, consumidas: 1, naoConsumidas: 1 },
  ])
})

test('topNaoConsumidos: só automáticos do período, por total e depois por nome', () => {
  const funcs = [{ id: 'a', nome: 'Rui' }, { id: 'b', nome: 'Ana' }, { id: 'c', nome: 'Zé' }]
  const cons = [
    { funcionario_id: 'a', ementa_id: 1, automatico: true }, { funcionario_id: 'a', ementa_id: 5, automatico: true },
    { funcionario_id: 'b', ementa_id: 1, automatico: true }, { funcionario_id: 'c', ementa_id: 1, automatico: true },
    { funcionario_id: 'c', ementa_id: 6, automatico: true }, { funcionario_id: 'b', ementa_id: 2 },
  ]
  assert.deepEqual(topNaoConsumidos(cons, funcs, ementas, ['2026-11-01', HOJE]).map(x => [x.f.nome, x.total]), [['Rui', 2], ['Ana', 1], ['Zé', 1]])
  assert.equal(topNaoConsumidos(cons, funcs, ementas, ['2026-11-01', HOJE], 1).length, 1)
})
