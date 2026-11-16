import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refeicoesPorMarcar, diasMarcaveis, marcacoesNaoConsumidas, faltamServir, refeicoesPorDia } from './marcar.js'

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

const funcs = [{ id: 1, nome: 'Zé' }, { id: 2, nome: 'Ana' }, { id: 3, nome: 'Bruno' }]
const nomes = r => r.map(f => f.nome)

test('faltamServir: marcados no prato sem consumo, por nome', () => {
  const m = [{ funcionario_id: 1, prato_num: 1 }, { funcionario_id: 2, prato_num: 1 }, { funcionario_id: 3, prato_num: 2 }]
  assert.deepEqual(nomes(faltamServir(m, [], funcs, 1)), ['Ana', 'Zé'])
})

test('faltamServir: consumo de quem não marcou não apaga quem falta', () => {
  // Bruno consumiu o prato 1 sem marcação: a subtração de totais daria 0, mas o Zé continua por servir
  const m = [{ funcionario_id: 1, prato_num: 1 }]
  const c = [{ funcionario_id: 3, prato_num: 1 }]
  assert.deepEqual(nomes(faltamServir(m, c, funcs, 1)), ['Zé'])
})

test('faltamServir: consumo de outro prato conta como servido', () => {
  const m = [{ funcionario_id: 1, prato_num: 1 }]
  const c = [{ funcionario_id: 1, prato_num: 2 }]
  assert.deepEqual(faltamServir(m, c, funcs, 1), [])
})

test('faltamServir: ignora marcações de funcionários desconhecidos', () => {
  assert.deepEqual(faltamServir([{ funcionario_id: 99, prato_num: 1 }], [], funcs, 1), [])
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

test('refeicoesPorDia: de hoje em diante, sem encerrados, fds conforme servir_fds, almoço primeiro', () => {
  const em = (id, data, tipo) => ({ id, data, tipo })
  const ementas = [em(1,'2026-11-13','A'), em(2,'2026-11-16','J'), em(3,'2026-11-16','A'), em(4,'2026-11-17','A'),
                   em(5,'2026-11-21','A'), em(6,'2026-11-18','A'), em(7,'2026-11-16','L')]
  const r = refeicoesPorDia(ementas, ['2026-11-18'], 'false', '2026-11-16')
  assert.deepEqual(r.map(d => [d.data, d.refeicoes.map(e => e.id)]), [['2026-11-16',[3,2]], ['2026-11-17',[4]]])
  assert.deepEqual(refeicoesPorDia(ementas, [], 'true', '2026-11-16').map(d => d.data), ['2026-11-16','2026-11-17','2026-11-18','2026-11-21'])
})
