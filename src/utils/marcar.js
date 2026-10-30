import { weekDays } from './ementaGrid.js'

// Ementas (almoço/jantar) de `data` em que o funcionário ainda não tem marcação; almoço primeiro.
export const refeicoesPorMarcar = (ementas, marcacoes, data) => {
  const marcadas = new Set(marcacoes.map(m => m.ementa_id))
  return ementas
    .filter(e => e.data === data && (e.tipo === 'A' || e.tipo === 'J') && !marcadas.has(e.id))
    .sort((a, b) => (a.tipo === 'A' ? -1 : 1) - (b.tipo === 'A' ? -1 : 1))
}

// Dias de seg–sex da semana `offset` em que a cantina abre (sem os de cantina_dias_fechados).
export const diasMarcaveis = (today, offset, fechados) => weekDays(today, offset).filter(d => !fechados.includes(d))
