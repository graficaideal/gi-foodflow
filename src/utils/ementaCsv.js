const TIPO  = { 'almoço':'A', 'jantar':'J' }
const PRATO = { carne:1, peixe:2, dieta:3, vegetariano:4, 'opção':4 }

// Excel PT exporta muitas vezes em Windows-1252; sem isto "Almoço" chega corrompido e a linha é ignorada
export const decodeCsv = buf => {
  try { return new TextDecoder('utf-8', { fatal:true }).decode(buf) }
  catch { return new TextDecoder('windows-1252').decode(buf) }
}

// CSV "DD/MM/YYYY;Almoço|Jantar;Label;Descrição" → uma linha por (data,tipo) para cantina_ementas
// devolve { rows, skipped } — skipped são os números (1-based) das linhas descartadas; linhas em branco não contam
export function parseEmentaCsv(text) {
  const byMeal = new Map()
  const skipped = []
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return
    const cols = line.split(';').map(c => c.trim())
    if (cols.length < 4 || cols.slice(0, 4).some(c => !c)) return skipped.push(i + 1)
    const [date, tipoRaw, label, desc] = cols
    const m = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    const tipo = TIPO[tipoRaw.toLowerCase()]
    const n = PRATO[label.toLowerCase()]
    if (!m || !tipo || !n) return skipped.push(i + 1)
    const data = `${m[3]}-${m[2]}-${m[1]}`
    const key = `${data}|${tipo}`
    // todos os campos presentes: colunas são NOT NULL e o upsert em lote envia null para chaves em falta
    if (!byMeal.has(key)) byMeal.set(key, {
      data, tipo,
      prato1_label:'', prato1_desc:'', prato2_label:'', prato2_desc:'',
      prato3_label:'', prato3_desc:'', prato4_label:'', prato4_desc:'',
    })
    const row = byMeal.get(key)
    // prato já preenchido nesta refeição (ex.: Vegetariano e Opção, ou linha repetida): fica o primeiro, este é descartado
    if (row[`prato${n}_label`]) return skipped.push(i + 1)
    row[`prato${n}_label`] = label
    row[`prato${n}_desc`] = desc
  })
  return { rows: [...byMeal.values()], skipped }
}
