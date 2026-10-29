import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LAST_MONTH } from './date.js'

test('LAST_MONTH: último dia do mês, incluindo fevereiro bissexto e dezembro', () => {
  assert.equal(LAST_MONTH(new Date(2026, 9, 29)), '2026-10-31')
  assert.equal(LAST_MONTH(new Date(2028, 1, 10)), '2028-02-29')
  assert.equal(LAST_MONTH(new Date(2026, 11, 1)), '2026-12-31')
})
