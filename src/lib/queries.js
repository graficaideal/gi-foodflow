import { supabase } from './supabase'
import { DEFAULTS } from '../constants/settings'
import { addD } from '../utils/date'

const mapFunc = r => ({...r, foto:r.foto_url})

export const fetchFuncionarios  = async () => { const {data}=await supabase.from('cantina_funcionarios').select('id,numero,nome,pin,rfid,foto_url,ativo,created_at').order('numero'); return (data||[]).map(mapFunc) }
export const fetchEmentas       = async () => { const {data}=await supabase.from('cantina_ementas').select('*').order('data').order('tipo'); return data||[] }
export const fetchMarcacoesAll  = async () => { const {data}=await supabase.from('cantina_marcacoes').select('*').order('created_at'); return data||[] }
export const fetchConsumos      = async () => { const {data}=await supabase.from('cantina_consumos').select('*').order('validado_em',{ascending:false}); return data||[] }
export const fetchDefinicoes    = async () => {
  const {data}=await supabase.from('cantina_definicoes').select('*')
  const s={...DEFAULTS}; for(const r of data||[]) s[r.chave]=r.valor; return s
}
export const saveDefinicao = async (chave,valor) =>
  supabase.from('cantina_definicoes').upsert({chave,valor,updated_at:new Date().toISOString()})

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

export const fetchMarcacoesSemConsumo = async (ementa_id) => {
  const { data } = await supabase
    .from('cantina_marcacoes')
    .select('*')
    .eq('ementa_id', ementa_id)
  // filtragem local dos que já têm consumo é feita no componente
  return data || []
}

export const insertConsumoBatch = async (registos) =>
  supabase.from('cantina_consumos').insert(registos)

export const deleteMarcacao = async (id) =>
  supabase.from('cantina_marcacoes').delete().eq('id', id)

export const fetchVisitantes = async () => {
  const { data } = await supabase.from('cantina_visitantes').select('*').order('registado_em', { ascending: false })
  return data || []
}

export const fetchConsumosPorData = async (data, limit) => {
  const { data:rows } = await supabase.from('cantina_consumos')
    .select('*')
    .gte('validado_em', `${data}T00:00:00`)
    .lt('validado_em', `${addD(data,1)}T00:00:00`)
    .order('validado_em', { ascending:false })
    .limit(limit)
  return rows || []
}

export const fetchVisitantesPorData = async (data, limit) => {
  const { data:rows } = await supabase.from('cantina_visitantes')
    .select('*')
    .gte('registado_em', `${data}T00:00:00`)
    .lt('registado_em', `${addD(data,1)}T00:00:00`)
    .order('registado_em', { ascending:false })
    .limit(limit)
  return rows || []
}

export const fetchMarcacoesPorPeriodo = async (dataInicio, dataFim) => {
  const { data:rows } = await supabase.from('cantina_marcacoes')
    .select('funcionario_id,ementa_id,prato_num,cantina_ementas!inner(data,tipo)')
    .gte('cantina_ementas.data', dataInicio)
    .lte('cantina_ementas.data', dataFim)
  return (rows||[]).map(r => ({funcionario_id:r.funcionario_id, ementa_id:r.ementa_id, prato_num:r.prato_num, data:r.cantina_ementas.data, tipo:r.cantina_ementas.tipo}))
}
