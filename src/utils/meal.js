export const toMin = t => { const [h,m]=(t||'00:00').split(':').map(Number); return h*60+m }

export const getMeal = s => {
  const cur = new Date().getHours()*60 + new Date().getMinutes()
  if (cur >= toMin(s.almoco_inicio) && cur <= toMin(s.almoco_fim)) return 'A'
  if (cur >= toMin(s.jantar_inicio) && cur <= toMin(s.jantar_fim)) return 'J'
  return null
}

export const fmtHorario = (s, tipo) => tipo==='A' ? `${s.almoco_inicio} – ${s.almoco_fim}` : `${s.jantar_inicio} – ${s.jantar_fim}`

export const fimRefeicao = (s, tipo) => tipo==='A' ? s.almoco_fim : s.jantar_fim

// Depois da hora de fim o fecho automático debita a marcação (sql/fecho_automatico.sql): já não se marca nem desmarca.
export const refeicaoTerminou = (s, tipo, data, hoje, agora = new Date()) =>
  data < hoje || (data === hoje && agora.getHours()*60 + agora.getMinutes() > toMin(fimRefeicao(s, tipo)))

export const getNextMeal = s => {
  const cur = new Date().getHours()*60 + new Date().getMinutes()
  if (cur < toMin(s.almoco_inicio)) return {tipo:'A', hora:s.almoco_inicio}
  if (cur < toMin(s.jantar_inicio)) return {tipo:'J', hora:s.jantar_inicio}
  return null
}
