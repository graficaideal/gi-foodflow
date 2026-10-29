import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchFunc } from './text.js'

test('matchFunc: nome sem acentos/maiúsculas, Nº parcial, vazio aceita tudo', () => {
  const f = {nome:'João Gonçalves', numero:'169'}
  assert.ok(matchFunc('joao', f) && matchFunc('GONCAL', f) && matchFunc('16', f) && matchFunc('  ', f))
  assert.ok(!matchFunc('ana', f))
  assert.ok(!matchFunc('ana', {nome:undefined, numero:undefined}))   // visitantes não têm nome
})
