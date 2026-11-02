import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refeicaoTerminou } from './meal.js'

const s = { almoco_fim: '14:30', jantar_fim: '21:30' }
const HOJE = '2026-11-02'
const as = hm => new Date(`${HOJE}T${hm}:00`)

test('refeicaoTerminou: hoje, aberta antes do início do serviço', () => {
  assert.equal(refeicaoTerminou(s, 'A', HOJE, HOJE, as('08:00')), false)
})

test('refeicaoTerminou: hoje, o minuto de fim ainda conta como aberto', () => {
  assert.equal(refeicaoTerminou(s, 'A', HOJE, HOJE, as('14:30')), false)
  assert.equal(refeicaoTerminou(s, 'A', HOJE, HOJE, as('14:31')), true)
})

test('refeicaoTerminou: cada refeição usa a sua hora de fim', () => {
  assert.equal(refeicaoTerminou(s, 'J', HOJE, HOJE, as('14:31')), false)
  assert.equal(refeicaoTerminou(s, 'J', HOJE, HOJE, as('21:31')), true)
})

test('refeicaoTerminou: dias futuros nunca terminaram; dias passados sim', () => {
  assert.equal(refeicaoTerminou(s, 'A', '2026-11-03', HOJE, as('23:00')), false)
  assert.equal(refeicaoTerminou(s, 'J', '2026-11-01', HOJE, as('08:00')), true)
})
