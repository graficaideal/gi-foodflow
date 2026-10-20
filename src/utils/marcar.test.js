import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refeicoesPorMarcar } from './marcar.js'

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
