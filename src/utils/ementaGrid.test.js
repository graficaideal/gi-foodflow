import { test } from 'node:test'
import assert from 'node:assert/strict'
import { week0, weekDays, isoWeekNum, mostFrequent, slotLabels, newEmentaRow } from './ementaGrid.js'

test('week0: dia útil volta à segunda; fim de semana salta para a seguinte', () => {
  assert.equal(week0('2026-10-21'), '2026-10-19') // quarta
  assert.equal(week0('2026-10-19'), '2026-10-19') // segunda
  assert.equal(week0('2026-10-24'), '2026-10-26') // sábado
  assert.equal(week0('2026-10-25'), '2026-10-26') // domingo
})

test('weekDays: segunda a sexta, com offset e mudança de mês', () => {
  assert.deepEqual(weekDays('2026-10-21', 0), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'])
  assert.deepEqual(weekDays('2026-10-21', 2), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])
  assert.equal(weekDays('2026-10-21', -1)[0], '2026-10-12')
})

test('isoWeekNum', () => {
  assert.equal(isoWeekNum('2026-06-01'), 23)
  assert.equal(isoWeekNum('2026-01-01'), 1)
  assert.equal(isoWeekNum('2027-01-01'), 53)
})

test('mostFrequent: ignora vazios, empate fica com o primeiro', () => {
  assert.equal(mostFrequent(['A', 'B', 'B', null, '']), 'B')
  assert.equal(mostFrequent(['A', 'B']), 'A')
  assert.equal(mostFrequent([null, '']), null)
})

test('slotLabels: prefere dias não passados, depois semana, depois última ementa, depois defeito', () => {
  const isPast = d => d < '2026-10-21'
  const row = (data, l1, l2 = 'P', l3 = 'D') => ({ data, prato1_label: l1, prato2_label: l2, prato3_label: l3 })
  const week = [row('2026-10-19', 'Antigo'), row('2026-10-21', 'Carne'), row('2026-10-22', 'Carne'), row('2026-10-23', 'Bife')]
  assert.deepEqual(slotLabels(week, isPast, week), ['Carne', 'P', 'D'])
  assert.deepEqual(slotLabels([row('2026-10-19', 'Antigo')], isPast, []), ['Antigo', 'P', 'D'])
  assert.deepEqual(slotLabels([], isPast, [row('2026-01-01', 'Velho'), row('2026-09-01', 'Recente')]), ['Recente', 'P', 'D'])
  assert.deepEqual(slotLabels([], isPast, []), ['Carne', 'Peixe', 'Dieta'])
})

test('newEmentaRow: slot 4 começa como Vegetariano e descrições a null', () => {
  assert.deepEqual(newEmentaRow('2026-10-21', 'J', ['a', 'b', 'c']), {
    data: '2026-10-21', tipo: 'J',
    prato1_label: 'a', prato1_desc: null, prato2_label: 'b', prato2_desc: null,
    prato3_label: 'c', prato3_desc: null, prato4_label: 'Vegetariano', prato4_desc: null,
  })
})
