import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refeicoesPorMarcar, diasMarcaveis, marcacoesNaoConsumidas } from './marcar.js'

const ems = [
  { id: 1, data: '2026-10-20', tipo: 'J' },
  { id: 2, data: '2026-10-20', tipo: 'A' },
  { id: 3, data: '2026-10-21', tipo: 'A' },
  { id: 4, data: '2026-10-20', tipo: 'X' },
]

test('refeicoesPorMarcar: só a data pedida, tipos A/J, almoço primeiro', () => {
  assert.deepEqual(refeicoesPorMarcar(ems, [], '2026-10-20').map(e => e.id), [2, 1])
})

test('refeicoesPorMarcar: exclui as já marcadas', () => {
  assert.deepEqual(refeicoesPorMarcar(ems, [{ ementa_id: 2 }], '2026-10-20').map(e => e.id), [1])
  assert.deepEqual(refeicoesPorMarcar(ems, [{ ementa_id: 1 }, { ementa_id: 2 }], '2026-10-20'), [])
})

test('refeicoesPorMarcar: sem ementas no dia', () => {
  assert.deepEqual(refeicoesPorMarcar(ems, [], '2026-10-22'), [])
})

const marcs = [
  { id: 10, ementa_id: 1, data: '2026-10-20', tipo: 'J' },
  { id: 11, ementa_id: 2, data: '2026-10-20', tipo: 'A' },
  { id: 12, ementa_id: 3, data: '2026-10-19', tipo: 'A' },
]
const ids = r => r.map(m => m.id)

test('marcacoesNaoConsumidas: sem consumo conta; ordena por data e almoço primeiro', () => {
  assert.deepEqual(ids(marcacoesNaoConsumidas(marcs, [], [])), [12, 11, 10])
})

test('marcacoesNaoConsumidas: consumo real exclui, consumo automático não', () => {
  const consumos = [{ ementa_id: 1, automatico: false }, { ementa_id: 2, automatico: true }, { ementa_id: 3, automatico: true }]
  assert.deepEqual(ids(marcacoesNaoConsumidas(marcs, consumos, [])), [12, 11])
})

test('marcacoesNaoConsumidas: exclui dias encerrados', () => {
  assert.deepEqual(ids(marcacoesNaoConsumidas(marcs, [], ['2026-10-20'])), [12])
})

test('marcacoesNaoConsumidas: exclui as já vistas nesta sessão', () => {
  assert.deepEqual(ids(marcacoesNaoConsumidas(marcs, [], [], [12, 10])), [11])
})

test('marcacoesNaoConsumidas: ignora tipos que não são almoço/jantar', () => {
  assert.deepEqual(marcacoesNaoConsumidas([{ id: 1, ementa_id: 1, data: '2026-10-20', tipo: 'X' }], [], []), [])
})

test('diasMarcaveis: seg–sex sem os dias fechados', () => {
  // 2026-10-21 é quarta → semana 19–23 Out
  assert.deepEqual(diasMarcaveis('2026-10-21', 0, ['2026-10-20', '2026-10-30']), ['2026-10-19', '2026-10-21', '2026-10-22', '2026-10-23'])
  assert.deepEqual(diasMarcaveis('2026-10-21', 1, []), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'])
})

test('diasMarcaveis: semana toda fechada → vazio', () => {
  assert.deepEqual(diasMarcaveis('2026-10-21', 0, ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']), [])
})
