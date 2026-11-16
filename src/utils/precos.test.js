import { test } from 'node:test'
import assert from 'node:assert/strict'
import { precoEm, valorDe, eur } from './precos.js'

const precos = [{ desde: '2026-03-01', valor: '5.50' }, { desde: '2026-01-01', valor: '5.00' }]   // ordem indiferente; valor numeric vem como texto

test('precoEm: preço em vigor na data, incluindo o próprio dia de início', () => {
  assert.equal(precoEm(precos, '2026-01-01'), 5)
  assert.equal(precoEm(precos, '2026-02-28'), 5)
  assert.equal(precoEm(precos, '2026-03-01'), 5.5)
  assert.equal(precoEm(precos, '2026-11-16'), 5.5)
})

test('precoEm: antes do primeiro preço ou sem preços dá null', () => {
  assert.equal(precoEm(precos, '2025-12-31'), null)
  assert.equal(precoEm([], '2026-05-01'), null)
})

test('valorDe: cada registo ao preço do seu dia, quantidades contam, sem erros de arredondamento', () => {
  const r = valorDe([{ desde: '2026-01-01', valor: '0.10' }], Array.from({ length: 3 }, () => ({ data: '2026-02-01', quantidade: 1 })))
  assert.equal(r.valor, 0.3)   // 0.1 + 0.1 + 0.1 em vírgula flutuante daria 0.30000000000000004
  assert.deepEqual(valorDe(precos, [
    { data: '2026-02-10', quantidade: 1 }, { data: '2026-03-10', quantidade: 2 }, { data: '2025-12-10', quantidade: 3 },
  ]), { valor: 16, semPreco: 3 })
})

test('eur: formato português com símbolo do euro', () => {
  assert.match(eur(1234.5), /^1\s?234,50\s€$/)
})
