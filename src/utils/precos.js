// Preço em vigor numa data: o de `desde` mais recente que não passa a data; null se ainda não havia preço.
export const precoEm = (precos, data) => {
  let atual = null
  for (const p of precos) if (p.desde <= data && (!atual || p.desde > atual.desde)) atual = p
  return atual ? Number(atual.valor) : null
}

// Valor de registos {data, quantidade} em euros, somado em cêntimos (sem erros de arredondamento);
// semPreco = refeições de dias anteriores ao primeiro preço.
export const valorDe = (precos, registos) => {
  let centimos = 0, semPreco = 0
  for (const r of registos) {
    const p = precoEm(precos, r.data)
    if (p === null) semPreco += r.quantidade
    else centimos += Math.round(p * 100) * r.quantidade
  }
  return { valor: centimos / 100, semPreco }
}

const fmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
export const eur = v => fmt.format(v)
