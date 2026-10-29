export const d2s = d => { const x=d instanceof Date?d:new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}` }
export const addD = (s,n) => { const d=new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return d2s(d) }
export const TODAY = d2s(new Date())
// [início, fim] do mês atual (offset 0), anterior (-1), …
export const monthRange = (offset=0, d=new Date()) => [d2s(new Date(d.getFullYear(), d.getMonth()+offset, 1)), d2s(new Date(d.getFullYear(), d.getMonth()+offset+1, 0))]

export const WD      = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
export const WD_FULL = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
export const MN      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
export const MN_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export const fmtS  = s => { const d=new Date(s+'T12:00:00'); return `${WD[d.getDay()]} ${d.getDate()} ${MN[d.getMonth()]}` }
export const fmtF  = s => { const d=new Date(s+'T12:00:00'); return `${WD_FULL[d.getDay()]}, ${d.getDate()} de ${MN[d.getMonth()]}` }
export const fmtHM = iso => iso ? new Date(iso).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}) : ''
