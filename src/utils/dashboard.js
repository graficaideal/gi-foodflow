import { addD, d2s } from './date.js'
import { weekDays } from './ementaGrid.js'
import { valorDe } from './precos.js'

const dataPorEmenta = ementas => new Map(ementas.map(e => [e.id, e.data]))

// Hoje, por refeição: marcações por prato, validadas (consumo real), por servir (marcação sem consumo) e visitantes.
export const resumoHoje = (ementas, marcacoes, consumos, visitantes, hoje) => ['A', 'J'].map(tipo => {
  const em = ementas.find(e => e.data === hoje && e.tipo === tipo)
  if (!em) return { tipo, em: null }
  const marc = marcacoes.filter(m => m.ementa_id === em.id)
  const cons = consumos.filter(c => c.ementa_id === em.id)
  const consumiram = new Set(cons.map(c => c.funcionario_id))
  return {
    tipo, em,
    marcadas:   marc.length,
    pratos:     [1, 2, 3, 4].filter(n => em[`prato${n}_label`])
                  .map(n => ({ n, label: em[`prato${n}_label`], marcadas: marc.filter(m => m.prato_num === n).length })),
    validadas:  cons.filter(c => !c.automatico).length,
    porServir:  marc.filter(m => !consumiram.has(m.funcionario_id)).length,
    visitantes: visitantes.filter(v => v.ementa_id === em.id).reduce((s, v) => s + v.quantidade, 0),
  }
})

// Próximos n dias com ementa (depois de hoje, sem encerrados): marcações de almoço e jantar (null = sem essa refeição).
export const proximosDias = (ementas, marcacoes, fechados, hoje, n = 5) => {
  const dias = [...new Set(ementas.filter(e => e.data > hoje && !fechados.includes(e.data)).map(e => e.data))].sort().slice(0, n)
  const conta = (d, tipo) => {
    const em = ementas.find(e => e.data === d && e.tipo === tipo)
    return em ? marcacoes.filter(m => m.ementa_id === em.id).length : null
  }
  return dias.map(d => ({ data: d, A: conta(d, 'A'), J: conta(d, 'J') }))
}

// Dias úteis desta semana (a partir de hoje) e da próxima sem nenhuma ementa publicada, fora os encerrados.
export const diasSemEmenta = (ementas, fechados, hoje) => {
  const com = new Set(ementas.map(e => e.data))
  return [...weekDays(hoje, 0), ...weekDays(hoje, 1)].filter(d => d >= hoje && !fechados.includes(d) && !com.has(d))
}

// [1.º dia do mês, mesmo dia do mês] — offset -1 = mesmo período do mês anterior (cortado no último dia desse mês).
export const periodoMes = (hoje, offset = 0) => {
  const [y, m, d] = hoje.split('-').map(Number)
  const ultimo = new Date(y, m + offset, 0).getDate()
  return [d2s(new Date(y, m - 1 + offset, 1)), d2s(new Date(y, m - 1 + offset, Math.min(d, ultimo)))]
}

// Refeições faturadas no período (pela data da ementa): validadas, não consumidas (fecho automático) e visitantes,
// e o valor ao preço em vigor em cada dia, no total e por categoria (semPreco = refeições antes do primeiro preço).
export const faturacao = (consumos, visitantes, ementas, [de, ate], precos = []) => {
  const data = dataPorEmenta(ementas)
  const dentro = id => { const d = data.get(id); return !!d && d >= de && d <= ate }
  const c = consumos.filter(x => dentro(x.ementa_id))
  const v = visitantes.filter(x => dentro(x.ementa_id))
  const r = {
    validadas:     c.filter(x => !x.automatico).length,
    naoConsumidas: c.filter(x => x.automatico).length,
    visitantes:    v.reduce((s, x) => s + x.quantidade, 0),
  }
  const reg = (lista, q = () => 1) => lista.map(x => ({ data: data.get(x.ementa_id), quantidade: q(x) }))
  const regs = { validadas: reg(c.filter(x => !x.automatico)), naoConsumidas: reg(c.filter(x => x.automatico)), visitantes: reg(v, x => x.quantidade) }
  const { valor, semPreco } = valorDe(precos, [...regs.validadas, ...regs.naoConsumidas, ...regs.visitantes])
  const valores = Object.fromEntries(Object.entries(regs).map(([k, rs]) => [k, valorDe(precos, rs).valor]))
  return { ...r, total: r.validadas + r.naoConsumidas + r.visitantes, valor, semPreco, valores }
}

// Variação percentual inteira; null sem base de comparação.
export const variacao = (atual, anterior) => anterior ? Math.round((atual - anterior) / anterior * 100) : null

// Consumos por dia nos últimos `dias` (só dias com registos): consumidas (validadas + visitantes) e não consumidas.
export const consumosPorDia = (consumos, visitantes, ementas, hoje, dias = 28) => {
  const de = addD(hoje, 1 - dias), data = dataPorEmenta(ementas), por = new Map()
  const add = (d, k, q) => {
    if (!d || d < de || d > hoje) return
    const x = por.get(d) || { data: d, consumidas: 0, naoConsumidas: 0 }
    x[k] += q
    por.set(d, x)
  }
  consumos.forEach(c => add(data.get(c.ementa_id), c.automatico ? 'naoConsumidas' : 'consumidas', 1))
  visitantes.forEach(v => add(data.get(v.ementa_id), 'consumidas', v.quantidade))
  return [...por.values()].sort((a, b) => a.data < b.data ? -1 : 1)
}

// Funcionários com mais refeições marcadas e não consumidas no período, com o valor ao preço de cada dia; empate por nome.
export const topNaoConsumidos = (consumos, funcionarios, ementas, [de, ate], precos = [], n = 5) => {
  const data = dataPorEmenta(ementas), dias = new Map()
  for (const c of consumos) {
    const d = data.get(c.ementa_id)
    if (c.automatico && d && d >= de && d <= ate) dias.set(c.funcionario_id, [...(dias.get(c.funcionario_id) || []), d])
  }
  return [...dias].map(([id, ds]) => ({ f: funcionarios.find(f => f.id === id), total: ds.length,
      valor: valorDe(precos, ds.map(d => ({ data: d, quantidade: 1 }))).valor }))
    .filter(x => x.f)
    .sort((a, b) => b.total - a.total || a.f.nome.localeCompare(b.f.nome, 'pt'))
    .slice(0, n)
}
