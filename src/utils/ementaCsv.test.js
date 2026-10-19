import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseEmentaCsv, decodeCsv } from './ementaCsv.js'

test('agrupa por (data,tipo) e mapeia labels para pratos', () => {
  const { rows, skipped } = parseEmentaCsv([
    '﻿03/11/2026;Almoço;Carne;Bife grelhado',
    '03/11/2026;Almoço;Peixe;Bacalhau',
    '03/11/2026;Almoço;Dieta;Frango cozido',
    '03/11/2026;Almoço;Opção;Omelete',
    '03/11/2026;Jantar;Vegetariano;Caril de grão\r',
  ].join('\n'))
  assert.equal(rows.length, 2)
  assert.deepEqual(skipped, [])
  assert.deepEqual(rows[0], {
    data:'2026-11-03', tipo:'A',
    prato1_label:'Carne', prato1_desc:'Bife grelhado',
    prato2_label:'Peixe', prato2_desc:'Bacalhau',
    prato3_label:'Dieta', prato3_desc:'Frango cozido',
    prato4_label:'Opção', prato4_desc:'Omelete',
  })
  assert.equal(rows[1].tipo, 'J')
  assert.equal(rows[1].prato4_desc, 'Caril de grão')
  assert.equal(rows[1].prato1_label, '')
})

test('descarta linhas inválidas e reporta os números de linha', () => {
  const { rows, skipped } = parseEmentaCsv([
    '',                                 // 1: em branco, não conta
    '03/11/2026;Almoço;Carne',          // 2: < 4 colunas
    '03/11/2026;Almoço;Carne;',         // 3: coluna vazia
    '2026-11-03;Almoço;Carne;X',        // 4: data noutro formato
    '03/11/2026;Lanche;Carne;X',        // 5: tipo desconhecido
    '03/11/2026;Almoço;Sobremesa;X',    // 6: label desconhecido
    '',                                 // 7: em branco final
  ].join('\n'))
  assert.deepEqual(rows, [])
  assert.deepEqual(skipped, [2, 3, 4, 5, 6])
})

test('prato repetido na mesma refeição: fica o primeiro, o seguinte é descartado', () => {
  const { rows, skipped } = parseEmentaCsv([
    '03/11/2026;Almoço;Vegetariano;Caril',
    '03/11/2026;Almoço;Opção;Omelete',
    '03/11/2026;Jantar;Opção;Omelete',
  ].join('\n'))
  assert.equal(rows.length, 2)
  assert.equal(rows[0].prato4_desc, 'Caril')
  assert.deepEqual(skipped, [2])
})

test('decodeCsv aceita UTF-8 e Windows-1252', () => {
  assert.equal(decodeCsv(new TextEncoder().encode('Almoço')), 'Almoço')
  assert.equal(decodeCsv(new Uint8Array([0x41,0x6c,0x6d,0x6f,0xe7,0x6f])), 'Almoço')
})
