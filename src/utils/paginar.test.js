import { test } from 'node:test'
import assert from 'node:assert/strict'
import { todasAsLinhas } from './paginar.js'

// Simula o PostgREST: devolve no máximo `max` linhas do intervalo pedido
const tabela = (n, max) => {
  const linhas = Array.from({ length: n }, (_, i) => ({ id: i }))
  const pedidos = []
  const consulta = () => ({ range: async (de, ate) => { pedidos.push([de, ate]); return { data: linhas.slice(de, Math.min(ate + 1, de + max)), error: null } } })
  return { consulta, pedidos }
}

test('todasAsLinhas: junta todas as páginas, sem repetir nem perder linhas', async () => {
  const { consulta } = tabela(2500, 1000)
  const r = await todasAsLinhas(consulta)
  assert.equal(r.length, 2500)
  assert.deepEqual(r.map(x => x.id), Array.from({ length: 2500 }, (_, i) => i))
})

test('todasAsLinhas: servidor com limite menor que a página não corta dados', async () => {
  const { consulta } = tabela(1200, 500)
  assert.equal((await todasAsLinhas(consulta)).length, 1200)
})

test('todasAsLinhas: tabela vazia e tabela pequena', async () => {
  assert.deepEqual(await todasAsLinhas(tabela(0, 1000).consulta), [])
  const { consulta, pedidos } = tabela(3, 1000)
  assert.equal((await todasAsLinhas(consulta)).length, 3)
  assert.deepEqual(pedidos, [[0, 999], [3, 1002]])
})

test('todasAsLinhas: erro do servidor é lançado, não engolido', async () => {
  const consulta = () => ({ range: async () => ({ data: null, error: new Error('falhou') }) })
  await assert.rejects(todasAsLinhas(consulta), /falhou/)
})
