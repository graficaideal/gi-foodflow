import { test } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { erroNovoPin, pinFormatoOk, hashPin } from './pin.js'

test('formato: só 4 dígitos', () => {
  for (const p of ['123', '12345', '12a4', '', ' 123']) assert.equal(pinFormatoOk(p), false, p)
  assert.equal(pinFormatoOk('0481'), true)
})

test('rejeita sequências ascendentes e descendentes', () => {
  for (const p of ['0123', '1234', '6789', '3210', '9876', '5432']) assert.match(erroNovoPin(p, '50'), /sequência/, p)
})

test('rejeita dígitos todos iguais', () => {
  for (const p of ['0000', '1111', '9999']) assert.match(erroNovoPin(p, '50'), /iguais/, p)
})

test('rejeita o número de funcionário com zeros à esquerda (1 a 3 caracteres)', () => {
  assert.match(erroNovoPin('0007', '7'),   /número/)
  assert.match(erroNovoPin('0042', '42'),  /número/)
  assert.match(erroNovoPin('0042', '042'), /número/)
  assert.match(erroNovoPin('0815', 815),   /número/)
})

test('aceita PINs válidos', () => {
  for (const p of ['0481', '1357', '2468', '7890', '1235']) assert.equal(erroNovoPin(p, '7'), null, p)
})

test('hash é $2a$ (pgcrypto) e valida o PIN', async () => {
  const h = await hashPin('0481')
  assert.match(h, /^\$2a\$10\$[./A-Za-z0-9]{53}$/)   // o mesmo formato que mobile_alterar_pin aceita
  assert.equal(bcrypt.compareSync('0481', h), true)
  assert.equal(bcrypt.compareSync('0482', h), false)
})
