import { test } from 'node:test'
import assert from 'node:assert/strict'
import { monthRange } from './date.js'

test('monthRange: mês atual e anterior, com fevereiro bissexto e viragem de ano', () => {
  assert.deepEqual(monthRange(0,  new Date(2026, 9, 29)), ['2026-10-01', '2026-10-31'])
  assert.deepEqual(monthRange(-1, new Date(2026, 9, 29)), ['2026-09-01', '2026-09-30'])
  assert.deepEqual(monthRange(0,  new Date(2028, 1, 10)), ['2028-02-01', '2028-02-29'])
  assert.deepEqual(monthRange(-1, new Date(2027, 0, 31)), ['2026-12-01', '2026-12-31'])
})
