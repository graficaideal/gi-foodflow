import { supabase } from './supabase'
import { DEFAULTS } from '../constants/settings'
import { todasAsLinhas } from '../utils/paginar'

const mapFunc = r => ({...r, foto:r.foto_url})

// Marcações e consumos de um funcionário, contados no servidor no momento (os dados em memória podem estar desatualizados)
export const contarMovimentos = async id => {
  const conta = t => supabase.from(t).select('id', { count:'exact', head:true }).eq('funcionario_id', id)
  const [m, c] = await Promise.all([conta('cantina_marcacoes'), conta('cantina_consumos')])
  if (m.error || c.error) throw m.error || c.error
  return { marcacoes:m.count, consumos:c.count }
}

export const fetchFuncionarios  = async () => { const {data}=await supabase.from('cantina_funcionarios').select('id,numero,nome,rfid,foto_url,ativo,created_at,tem_pin,pin_alterado,acesso_mobile').order('numero'); return (data||[]).map(mapFunc) }
// Sem rede devolve [] (o App mantém as ementas que tem)
export const fetchEmentas       = async (desde) => todasAsLinhas(() => { let q=supabase.from('cantina_ementas').select('*'); if(desde) q=q.gte('data',desde); return q.order('data').order('tipo').order('id') }).catch(() => [])
export const fetchMarcacoesAll  = () => todasAsLinhas(() => supabase.from('cantina_marcacoes').select('*').order('created_at').order('id'))
export const fetchConsumos      = () => todasAsLinhas(() => supabase.from('cantina_consumos').select('*').order('validado_em',{ascending:false}).order('id'))
export const fetchDefinicoes    = async (chaves) => {
  let q=supabase.from('cantina_definicoes').select('*'); if(chaves) q=q.in('chave',chaves)
  const {data}=await q
  const s={...DEFAULTS}; for(const r of data||[]) s[r.chave]=r.valor; return s
}
export const saveDefinicao = async (chave,valor) =>
  supabase.from('cantina_definicoes').upsert({chave,valor,updated_at:new Date().toISOString()},{onConflict:'chave'})

export const fetchDiasFechados = async () => {
  const {data} = await supabase.from('cantina_dias_fechados').select('data')
  return (data||[]).map(r => r.data)
}
export const setDiaFechado   = async data => supabase.from('cantina_dias_fechados').insert({data})
export const unsetDiaFechado = async data => supabase.from('cantina_dias_fechados').delete().eq('data',data)

export const insertVisitantes = async (ementa_id, prato_num, quantidade) =>
  supabase.from('cantina_visitantes').insert({ ementa_id, prato_num, quantidade }).select().single()

export const deleteConsumo = async (id) =>
  supabase.from('cantina_consumos').delete().eq('id', id)

export const deleteVisitante = async (id) =>
  supabase.from('cantina_visitantes').delete().eq('id', id)

export const deleteMarcacao = async (id) =>
  supabase.from('cantina_marcacoes').delete().eq('id', id)

export const fetchVisitantes = () =>
  todasAsLinhas(() => supabase.from('cantina_visitantes').select('*').order('registado_em', { ascending: false }).order('id'))

export const fetchConsumosPorEmenta = async (ementaId, limit) => {
  const { data:rows } = await supabase.from('cantina_consumos')
    .select('*')
    .eq('ementa_id', ementaId)
    .order('validado_em', { ascending:false })
    .limit(limit)
  return rows || []
}

export const fetchVisitantesPorEmenta = async (ementaId, limit) => {
  const { data:rows } = await supabase.from('cantina_visitantes')
    .select('*')
    .eq('ementa_id', ementaId)
    .order('registado_em', { ascending:false })
    .limit(limit)
  return rows || []
}

// Marcações de um funcionário em [dataInicio, dataFim) e respetivos consumos.
// Lança em erro: consumos em falta fariam parecer não consumidas refeições que o foram.
export const fetchMarcacoesEConsumos = async (funcionarioId, dataInicio, dataFim) => {
  const { data:rows, error } = await supabase.from('cantina_marcacoes')
    .select('id,ementa_id,cantina_ementas!inner(data,tipo)')
    .eq('funcionario_id', funcionarioId)
    .gte('cantina_ementas.data', dataInicio)
    .lt('cantina_ementas.data', dataFim)
  if (error) throw error
  const marcacoes = rows.map(r => ({id:r.id, ementa_id:r.ementa_id, data:r.cantina_ementas.data, tipo:r.cantina_ementas.tipo}))
  if (!marcacoes.length) return { marcacoes, consumos:[] }
  const { data:consumos, error:errC } = await supabase.from('cantina_consumos')
    .select('ementa_id,automatico')
    .eq('funcionario_id', funcionarioId)
    .in('ementa_id', marcacoes.map(m => m.ementa_id))
  if (errC) throw errC
  return { marcacoes, consumos }
}

// Sem rede devolve [] (a impressão sai vazia, como antes)
export const fetchMarcacoesPorPeriodo = async (dataInicio, dataFim) => {
  const rows = await todasAsLinhas(() => supabase.from('cantina_marcacoes')
    .select('id,funcionario_id,ementa_id,prato_num,cantina_ementas!inner(data,tipo)')
    .gte('cantina_ementas.data', dataInicio)
    .lte('cantina_ementas.data', dataFim)
    .order('id')).catch(() => [])
  return rows.map(r => ({funcionario_id:r.funcionario_id, ementa_id:r.ementa_id, prato_num:r.prato_num, data:r.cantina_ementas.data, tipo:r.cantina_ementas.tipo}))
}

// ── PIN e acesso mobile (sql/acesso_mobile.sql). Erros das RPCs chegam em error.message (ex.: 'sessao_invalida').
const rpc = async (fn, args) => { const { data, error } = await supabase.rpc(fn, args); if (error) throw error; return data }

export const verificarPin     = (funcionarioId, pin) => rpc('verificar_pin', { p_funcionario_id:String(funcionarioId), p_pin:pin })   // 'ok'|'errado'|'bloqueado'|'sem_pin'
export const mobileLogin      = (numero, pin)        => rpc('mobile_login', { p_numero:numero, p_pin:pin })
export const mobileAlterarPin = (token, pinHash)     => rpc('mobile_alterar_pin', { p_token:token, p_pin_hash:pinHash })
export const mobileMarcacoes  = token                => rpc('mobile_marcacoes', { p_token:token })
export const mobileMarcar     = (token, ementaId, n) => rpc('mobile_marcar', { p_token:token, p_ementa_id:String(ementaId), p_prato_num:n })
export const mobileDesmarcar  = (token, ementaId)    => rpc('mobile_desmarcar', { p_token:token, p_ementa_id:String(ementaId) })

// PIN inicial / reset pelo backoffice: obriga a alterar no próximo login mobile. O trigger limpa bloqueio e sessões.
export const definirPinInicial = (id, pinHash) =>
  supabase.from('cantina_funcionarios').update({ pin_hash:pinHash, pin_alterado:false }).eq('id', id)
