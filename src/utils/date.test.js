import { test } from 'node:test'
import assert from 'node:assert/strict'
import { monthRange, proximoDiaUtil } from './date.js'

test('monthRange: mês atual e anterior, com fevereiro bissexto e viragem de ano', () => {
  assert.deepEqual(monthRange(0,  new Date(2026, 9, 29)), ['2026-10-01', '2026-10-31'])
  assert.deepEqual(monthRange(-1, new Date(2026, 9, 29)), ['2026-09-01', '2026-09-30'])
  assert.deepEqual(monthRange(0,  new Date(2028, 1, 10)), ['2028-02-01', '2028-02-29'])
  assert.deepEqual(monthRange(-1, new Date(2027, 0, 31)), ['2026-12-01', '2026-12-31'])
})

test('proximoDiaUtil: seg–qui → dia seguinte; sex/sáb/dom → segunda', () => {
  assert.equal(proximoDiaUtil('2026-10-26'), '2026-10-27') // seg
  assert.equal(proximoDiaUtil('2026-10-29'), '2026-10-30') // qui
  assert.equal(proximoDiaUtil('2026-10-30'), '2026-11-02') // sex
  assert.equal(proximoDiaUtil('2026-10-31'), '2026-11-02') // sáb
  assert.equal(proximoDiaUtil('2026-11-01'), '2026-11-02') // dom
  assert.equal(proximoDiaUtil('2026-12-31'), '2027-01-01') // qui, viragem de ano
})
