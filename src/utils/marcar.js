import { weekDays } from './ementaGrid.js'

// Ementas (almoço/jantar) de `data` em que o funcionário ainda não tem marcação; almoço primeiro.
export const refeicoesPorMarcar = (ementas, marcacoes, data) => {
  const marcadas = new Set(marcacoes.map(m => m.ementa_id))
  return ementas
    .filter(e => e.data === data && (e.tipo === 'A' || e.tipo === 'J') && !marcadas.has(e.id))
    .sort((a, b) => (a.tipo === 'A' ? -1 : 1) - (b.tipo === 'A' ? -1 : 1))
}

// Marcações sem consumo real, mais antigas primeiro. Consumo automatico = fecho da refeição sem validação, logo não conta.
// Dias encerrados ficam de fora: o fecho automático também os ignora, nada foi debitado.
export const marcacoesNaoConsumidas = (marcacoes, consumos, fechados, vistos = []) => {
  const consumidas = new Set(consumos.filter(c => !c.automatico).map(c => c.ementa_id))
  return marcacoes
    .filter(m => (m.tipo === 'A' || m.tipo === 'J') && !consumidas.has(m.ementa_id) && !fechados.includes(m.data) && !vistos.includes(m.id))
    .sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo))
}

// Dias de seg–sex da semana `offset` em que a cantina abre (sem os de cantina_dias_fechados).
export const diasMarcaveis = (today, offset, fechados) => weekDays(today, offset).filter(d => !fechados.includes(d))
