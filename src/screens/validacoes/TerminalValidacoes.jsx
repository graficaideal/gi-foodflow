import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { insertVisitantes, fetchConsumosPorData, fetchVisitantesPorData, fetchMarcacoesPorPeriodo, deleteConsumo, deleteVisitante, fetchMarcacoesSemConsumo, insertConsumoBatch, deleteMarcacao } from '../../lib/queries'
import { C } from '../../constants/colors'
import { DEFAULTS } from '../../constants/settings'
import { getMeal, getNextMeal, toMin } from '../../utils/meal'
import { fmtHM, fmtS, TODAY, WD, MN, addD } from '../../utils/date'
import { pratoColors } from '../../constants/pratos'
import Avatar from '../../components/Avatar'
import Icon from '../../components/Icon'
import Logo from '../../components/Logo'
import LoginShell, { ARR } from '../../components/LoginShell'
import PratoTag from '../../components/PratoTag'
import PratoBtn from '../../components/PratoBtn'
import useSerial from '../../hooks/useSerial'
import { refeicoesPorMarcar } from '../../utils/marcar'

// Cores específicas dos takeovers deste ecrã — não são tokens globais
const V = {
  standby:'#0f1217', panel:'#16191f', panelHi:'#1a1f27',
  ok:'#0d2e22', okCard:'#0a3a2a',
  dup:'#2d2208', dupCard:'#3a2c0a',
  no:'#2a1315', noCard:'#371619', noBtn:'#3f1c1f',
}

function Pessoa({func, ring, avatar=220, font=60, width=360, metaColor}) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:avatar>200?20:16,flexShrink:0,width}}>
      <Avatar nome={func.nome} foto={func.foto} size={avatar} ring={ring}/>
      <div style={{textAlign:'center'}}>
        {func.nome.split(' ').map((w,i) => (
          <div key={i} style={{fontSize:font,lineHeight:1,color:'#fff',letterSpacing:'-0.01em'}}>{w}</div>
        ))}
        <div style={{fontSize:avatar>200?15:14,color:metaColor,marginTop:avatar>200?10:8,letterSpacing:'0.04em'}}>Nº {func.numero}</div>
      </div>
    </div>
  )
}

export default function TerminalValidacoes({funcionarios,ementas,settings,onBack}) {
  const s = {...DEFAULTS,...settings}
  const isKiosk = new URLSearchParams(window.location.search).get('kiosk') === '1'
  const [numInput,   setNumInput]   = useState('')
  const [status,     setStatus]     = useState(null)
  const [recentes,   setRecentes]   = useState([])
  const [contadores, setContadores] = useState([])
  const [manualMode, setManualMode] = useState(false)
  const [visitorMode, setVisitorMode] = useState(false)
  const [visitorPrato,setVisitorPrato] = useState(null)
  const [visitorQtd,  setVisitorQtd]   = useState(1)
  const [tick,       setTick]       = useState(0)   // força re-render a cada 30s
  const [showMarc,    setShowMarc]    = useState(false)
  const [marcPeriodo, setMarcPeriodo] = useState('amanha') // 'hoje' | 'amanha' | 'entre'
  const [marcDe,       setMarcDe]     = useState(TODAY)
  const [marcAte,      setMarcAte]    = useState(TODAY)
  const [marcRefeicao, setMarcRefeicao] = useState('ambos') // 'A' | 'J' | 'ambos'
  const [marcsAtuais, setMarcsAtuais] = useState([])
  const [consAtuais,  setConsAtuais]  = useState([])
  const [faltamModal, setFaltamModal] = useState(null) // {n,label}
  const [anularAlvo,  setAnularAlvo]  = useState(null) // recente a anular
  const [showDesmarcar, setShowDesmarcar] = useState(false)
  const [desmarcarPesquisa, setDesmarcarPesquisa] = useState('')
  const [desmarcarQuery,    setDesmarcarQuery]    = useState('') // só atualiza ao confirmar (ENTER)
  const [desmarcarFunc,     setDesmarcarFunc]     = useState(null)
  const [desmarcarMarcs,    setDesmarcarMarcs]     = useState(null) // null = não carregado ainda
  const [desmarcarConfirm,  setDesmarcarConfirm]   = useState(null) // marcação pendente de confirmação
  const [showMarcar,  setShowMarcar]  = useState(false)
  const [marcarNum,   setMarcarNum]   = useState('')
  const [marcarFunc,  setMarcarFunc]  = useState(null)  // null = por pesquisar, false = não encontrado
  const [marcarRefs,  setMarcarRefs]  = useState(null)  // ementas de hoje por marcar; null = a carregar
  const [marcarEm,    setMarcarEm]    = useState(null)  // ementa escolhida, à espera do prato
  const [marcarErro,  setMarcarErro]  = useState('')

  // Relógio: reavalia getMeal() periodicamente
  useEffect(() => {
    const id = setInterval(() => setTick(t=>t+1), 30000)
    return () => clearInterval(id)
  }, [])

  const meal = getMeal(s)   // null quando fora do horário

  // Fecho automático do serviço: na transição 'A'/'J' → null, marca como consumidas
  // todas as marcações da refeição que acabou de fechar que ainda não têm consumo
  const prevMealRef = useRef(meal)
  useEffect(() => {
    if(prevMealRef.current && !meal) fecharServicoAutomaticamente(prevMealRef.current)
    prevMealRef.current = meal
  }, [meal])

  const fecharServicoAutomaticamente = async tipoFechado => {
    const ementaFechada = ementas.find(e=>e.data===TODAY&&e.tipo===tipoFechado)
    if(!ementaFechada) return
    const [marcs,{data:cons}] = await Promise.all([
      fetchMarcacoesSemConsumo(ementaFechada.id),
      supabase.from('cantina_consumos').select('funcionario_id').eq('ementa_id',ementaFechada.id),
    ])
    const jaConsumidos = new Set((cons||[]).map(c=>c.funcionario_id))
    const pendentes = marcs.filter(m=>!jaConsumidos.has(m.funcionario_id))
    if(pendentes.length===0) return
    const agora = new Date().toISOString()
    await insertConsumoBatch(pendentes.map(m=>({funcionario_id:m.funcionario_id,ementa_id:ementaFechada.id,prato_num:m.prato_num,validado_em:agora})))
    loadContadores(ementaAtual)
  }

  // Ref para process() — evita stale closure no useSerial
  const processRef = useRef(null)
  const onUidRef   = useRef(uid => { if(processRef.current) processRef.current(uid,true) })

  const {serialStatus,connect:connectSerial} = useSerial(onUidRef)

  const reset = () => { setNumInput(''); setStatus(null); setManualMode(false) }

  const ementaAtual = meal ? ementas.find(e=>e.data===TODAY&&e.tipo===meal) : null

  const loadContadores = async em => {
    if(!em){ setContadores([]); setMarcsAtuais([]); setConsAtuais([]); return }
    const [{data:marcs},{data:cons}] = await Promise.all([
      supabase.from('cantina_marcacoes').select('funcionario_id,prato_num').eq('ementa_id',em.id),
      supabase.from('cantina_consumos').select('funcionario_id,prato_num').eq('ementa_id',em.id),
    ])
    setMarcsAtuais(marcs||[])
    setConsAtuais(cons||[])
    setContadores([1,2,3,4].map(n => {
      const label = em[`prato${n}_label`]
      if(!label) return null
      const total  = (marcs||[]).filter(m=>m.prato_num===n).length
      const served = (cons ||[]).filter(c=>c.prato_num===n).length
      return {n,label,total,left:Math.max(0,total-served)}
    }).filter(Boolean))
  }

  // Colaboradores com este prato marcado que ainda não consumiram — a partir dos dados já em memória
  const faltamPorPrato = n => {
    const consumidos = new Set(consAtuais.filter(c=>c.prato_num===n).map(c=>c.funcionario_id))
    return marcsAtuais
      .filter(m => m.prato_num===n && !consumidos.has(m.funcionario_id))
      .map(m => funcionarios.find(f=>f.id===m.funcionario_id))
      .filter(Boolean)
      .sort((a,b) => a.nome.localeCompare(b.nome))
  }

  const loadRecentes = async () => {
    const limit = parseInt(s.validacao_sidebar_num) || 10
    const [consumos,vis] = await Promise.all([
      fetchConsumosPorData(TODAY,limit),
      fetchVisitantesPorData(TODAY,limit),
    ])
    const rows = [
      ...consumos.map(c => {
        const f  = funcionarios.find(f=>f.id===c.funcionario_id)
        const em = ementas.find(e=>e.id===c.ementa_id)
        const pk = `prato${c.prato_num}`
        return {id:c.id,validado_em:c.validado_em,nome:f?.nome||'—',foto:f?.foto,pratoNum:c.prato_num,pratoLabel:em?.[pk+'_label'],pratoDesc:em?.[pk+'_desc']}
      }),
      ...vis.map(v => {
        const em = ementas.find(e=>e.id===v.ementa_id)
        const pk = `prato${v.prato_num}`
        return {id:`v-${v.id}`,validado_em:v.registado_em,nome:'Visitantes',foto:null,quantidade:v.quantidade,isVisitante:true,pratoNum:v.prato_num,pratoLabel:em?.[pk+'_label'],pratoDesc:em?.[pk+'_desc']}
      }),
    ].sort((a,b)=>new Date(b.validado_em)-new Date(a.validado_em)).slice(0,limit)
    setRecentes(rows)
  }

  useEffect(() => { loadContadores(ementaAtual) }, [ementaAtual?.id])
  useEffect(() => { loadRecentes() }, [])

  const confirmarConsumo = async (func,ementa,pratoNum) => {
    const {data,error} = await supabase.from('cantina_consumos').insert({funcionario_id:func.id,ementa_id:ementa.id,prato_num:pratoNum}).select().single()
    if(error) return
    const pk=`prato${pratoNum}`,pratoLabel=ementa[pk+'_label'],pratoDesc=ementa[pk+'_desc']
    setRecentes(p=>[{id:data.id,validado_em:data.validado_em,nome:func.nome,foto:func.foto,pratoNum,pratoLabel,pratoDesc},...p].slice(0,parseInt(s.validacao_sidebar_num)||10))
    loadContadores(ementa)
    setStatus({type:'ok',func,pratoNum,pratoLabel,pratoDesc})
    setTimeout(reset,parseInt(s.validacao_tempo_ok)*1000)
  }

  const cancelVisitorMode = () => { setVisitorMode(false); setVisitorPrato(null); setVisitorQtd(1) }

  const confirmarVisitantes = async () => {
    if(!visitorPrato || !ementaAtual) return
    const qtd = visitorQtd
    const {data,error} = await insertVisitantes(ementaAtual.id, visitorPrato, qtd)
    if(error) return
    const pk=`prato${visitorPrato}`,pratoLabel=ementaAtual[pk+'_label'],pratoDesc=ementaAtual[pk+'_desc']
    setRecentes(p=>[{id:`v-${data.id}`,validado_em:data.registado_em||new Date().toISOString(),nome:'Visitante(s)',foto:null,quantidade:qtd,isVisitante:true,pratoNum:visitorPrato,pratoLabel,pratoDesc},...p].slice(0,parseInt(s.validacao_sidebar_num)||10))
    cancelVisitorMode()
    setStatus({type:'visitor-ok',qtd,pratoNum:visitorPrato,pratoLabel,pratoDesc})
    setTimeout(reset,3000)
  }

  const imprimirMarcacoes = async () => {
    const dataInicio = marcPeriodo==='hoje' ? TODAY : marcPeriodo==='amanha' ? addD(TODAY,1) : marcDe
    const dataFim     = marcPeriodo==='hoje' ? TODAY : marcPeriodo==='amanha' ? addD(TODAY,1) : marcAte
    const rows = await fetchMarcacoesPorPeriodo(dataInicio,dataFim)
    const enriched = rows
      .filter(r => marcRefeicao==='ambos' || r.tipo===marcRefeicao)
      .map(r => {
        const f  = funcionarios.find(f=>f.id===r.funcionario_id)
        const em = ementas.find(e=>e.id===r.ementa_id)
        const pk = `prato${r.prato_num}`
        return {numero:f?.numero||'—', nome:f?.nome||'—', prato:em?.[pk+'_label']||'—', num:r.prato_num, data:r.data, tipo:r.tipo}
      })
    const porNumero = (a,b) => (a.numero||'').localeCompare(b.numero||'', undefined, {numeric:true})
    const groups = marcRefeicao==='ambos'
      ? [{label:'ALMOÇO', rows:enriched.filter(r=>r.tipo==='A').sort(porNumero)},
         {label:'JANTAR',  rows:enriched.filter(r=>r.tipo==='J').sort(porNumero)}].filter(g=>g.rows.length>0)
      : [{label:null, rows:[...enriched].sort(porNumero)}]

    const periodoLabel  = marcPeriodo==='hoje' ? 'Hoje' : marcPeriodo==='amanha' ? 'Amanhã' : `${fmtS(dataInicio)} a ${fmtS(dataFim)}`
    const refeicaoLabel = marcRefeicao==='A' ? 'Almoço' : marcRefeicao==='J' ? 'Jantar' : 'Almoço + Jantar'
    const agora = new Date()
    const agoraStr = `${String(agora.getDate()).padStart(2,'0')}/${String(agora.getMonth()+1).padStart(2,'0')}/${agora.getFullYear()} ${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`
    const esc = v => String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

    // Agrupa por prato_num; o nome é a label do slot na ementa mais recente do período
    const contarTotais = rows => {
      const by = {}
      rows.forEach(r => {
        const g = by[r.num] ||= {count:0,label:null,data:''}
        g.count++
        if (r.prato!=='—' && r.data>=g.data) { g.label=r.prato; g.data=r.data }
      })
      return Object.keys(by).sort((a,b)=>a-b).map(n=>[by[n].label||`Prato ${n}`, by[n].count])
    }

    const rowsHtml = groups.map(g => `
      ${g.label ? `<div class="sub">${g.label} (${g.rows.length})</div>` : ''}
      <table>
        <tr><th>Nº</th><th>Nome</th><th>Prato</th></tr>
        ${g.rows.map(r=>`<tr><td>${esc(r.numero)}</td><td>${esc(r.nome)}</td><td>${esc(r.prato)}</td></tr>`).join('')}
      </table>
      <div class="total">Total: ${g.rows.length} marcaç${g.rows.length===1?'ão':'ões'}</div>
    `).join('<div class="sep"></div>')

    const totaisHtml = groups.map(g => `
      <div class="sub">${g.label ? `TOTAIS — ${g.label}` : 'TOTAIS'}</div>
      <div class="sep"></div>
      <table class="totais">
        ${contarTotais(g.rows).map(([label,count])=>`<tr><td>${esc(label)}</td><td class="num">${count}</td></tr>`).join('')}
      </table>
    `).join('<div class="sep"></div>')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Marcações</title><style>
      @page { size: 80mm auto; margin: 4mm; }
      * { color:#000 !important; background:#fff !important; box-sizing:border-box; }
      body { font-family: monospace; font-size: 11px; width: 72mm; margin:0; }
      .titulo { text-align:center; font-weight:bold; font-size:14px; }
      .sep { border-top:1px dashed #000; margin:6px 0; }
      .sub { font-weight:bold; margin-top:6px; }
      table { width:100%; border-collapse:collapse; margin-top:4px; }
      th,td { text-align:left; padding:2px 0; vertical-align:top; }
      th:first-child,td:first-child { width:22px; }
      .total { font-weight:bold; margin-top:6px; }
      table.totais td.num { text-align:right; font-weight:700; }
    </style></head><body>
      <div class="titulo">FOODFLOW</div>
      <div class="sep"></div>
      <div>Impresso: ${agoraStr}</div>
      <div>${periodoLabel} · ${refeicaoLabel}</div>
      <div class="sep"></div>
      ${rowsHtml}
      <div class="sep"></div>
      ${totaisHtml}
      <div class="sep"></div>
      <table class="totais"><tr><td><strong>TOTAL GERAL</strong></td><td class="num"><strong>${enriched.length}</strong></td></tr></table>
      <div class="sep"></div>
    </body></html>`

    const win = window.open('', '_blank', 'width=400,height=600')
    if(!win) return
    win.document.write(html)
    win.document.close()
    win.onafterprint = () => win.close()
    win.focus()
    win.print()
    setShowMarc(false)
  }

  const anularConsumo = async () => {
    if(!anularAlvo) return
    const r = anularAlvo
    if(r.isVisitante) await deleteVisitante(r.id.replace(/^v-/,''))
    else await deleteConsumo(r.id)
    setRecentes(p=>p.filter(x=>x.id!==r.id))
    loadContadores(ementaAtual)
    setAnularAlvo(null)
  }

  const selecionarFuncDesmarcar = async func => {
    setDesmarcarFunc(func)
    setDesmarcarMarcs(null)
    const emsFuturas = ementas.filter(e=>e.data>=TODAY&&(e.tipo==='A'||e.tipo==='J'))
    const emIds = emsFuturas.map(e=>e.id)
    if(emIds.length===0){ setDesmarcarMarcs([]); return }
    const [{data:marcs},{data:cons}] = await Promise.all([
      supabase.from('cantina_marcacoes').select('id,ementa_id,prato_num').eq('funcionario_id',func.id).in('ementa_id',emIds),
      supabase.from('cantina_consumos').select('ementa_id').eq('funcionario_id',func.id).in('ementa_id',emIds),
    ])
    const consumidos = new Set((cons||[]).map(c=>c.ementa_id))
    const pendentes = (marcs||[]).filter(m=>!consumidos.has(m.ementa_id)).map(m => {
      const em = emsFuturas.find(e=>e.id===m.ementa_id)
      const pk = `prato${m.prato_num}`
      return {id:m.id, data:em.data, tipo:em.tipo, pratoLabel:em[pk+'_label']}
    }).sort((a,b) => a.data!==b.data ? a.data.localeCompare(b.data) : (a.tipo==='A'?-1:1) - (b.tipo==='A'?-1:1))
    setDesmarcarMarcs(pendentes)
  }

  const cancelarMarcacao = async () => {
    if(!desmarcarConfirm) return
    const marc = desmarcarConfirm
    await deleteMarcacao(marc.id)
    setDesmarcarMarcs(p=>p.filter(m=>m.id!==marc.id))
    loadContadores(ementaAtual)
    setDesmarcarConfirm(null)
  }

  const fecharDesmarcar = () => {
    setShowDesmarcar(false); setDesmarcarPesquisa(''); setDesmarcarQuery(''); setDesmarcarFunc(null); setDesmarcarMarcs(null); setDesmarcarConfirm(null)
  }

  const executarPesquisaDesmarcar = () => {
    if(desmarcarPesquisa.length===0) return
    setDesmarcarQuery(desmarcarPesquisa)
  }

  // Teclado físico ativo enquanto o modal Desmarcar está aberto
  useEffect(() => {
    if(!showDesmarcar) return
    const h = e => {
      if(e.key==='Escape'){ fecharDesmarcar(); return }
      if(desmarcarFunc) return // fora do passo de pesquisa
      if(e.key>='0'&&e.key<='9'){ setDesmarcarPesquisa(p=>p.length<10?p+e.key:p); return }
      if(e.key==='Backspace'){ setDesmarcarPesquisa(p=>p.slice(0,-1)); return }
      if(e.key==='Enter'){ executarPesquisaDesmarcar(); return }
    }
    window.addEventListener('keydown',h)
    return () => window.removeEventListener('keydown',h)
  }, [showDesmarcar, desmarcarFunc, desmarcarPesquisa])

  const fecharMarcar = () => {
    setShowMarcar(false); setMarcarNum(''); setMarcarFunc(null); setMarcarRefs(null); setMarcarEm(null); setMarcarErro('')
  }

  // Editar o número limpa o "não encontrado" anterior
  const digitarMarcar = fn => { setMarcarNum(fn); setMarcarFunc(null) }

  const executarPesquisaMarcar = async () => {
    const num = marcarNum.trim()
    if(!num) return
    const func = funcionarios.find(f=>f.ativo && f.numero===num)
    if(!func){ setMarcarFunc(false); return }
    setMarcarFunc(func)
    setMarcarRefs(null)
    const emsHoje = ementas.filter(e=>e.data===TODAY)
    const {data} = emsHoje.length===0 ? {data:[]} : await supabase.from('cantina_marcacoes').select('ementa_id').eq('funcionario_id',func.id).in('ementa_id',emsHoje.map(e=>e.id))
    setMarcarRefs(refeicoesPorMarcar(emsHoje, data||[], TODAY))
  }

  const marcarPrato = async n => {
    const em = marcarEm
    const {error} = await supabase.from('cantina_marcacoes').upsert({funcionario_id:marcarFunc.id,ementa_id:em.id,prato_num:n},{onConflict:'funcionario_id,ementa_id'})
    if(error){ setMarcarErro('Não foi possível gravar a marcação. Tenta novamente.'); return }
    loadContadores(ementaAtual)
    const restantes = marcarRefs.filter(e=>e.id!==em.id)
    if(restantes.length===0){ fecharMarcar(); return }
    setMarcarRefs(restantes); setMarcarEm(null); setMarcarErro('')
  }

  // Teclado físico ativo enquanto o modal Marcar está aberto
  useEffect(() => {
    if(!showMarcar) return
    const h = e => {
      if(e.key==='Escape'){ fecharMarcar(); return }
      if(marcarFunc) return // fora do passo de pesquisa
      if(e.key>='0'&&e.key<='9'){ digitarMarcar(p=>p.length<10?p+e.key:p); return }
      if(e.key==='Backspace'){ digitarMarcar(p=>p.slice(0,-1)); return }
      if(e.key==='Enter'){ executarPesquisaMarcar(); return }
    }
    window.addEventListener('keydown',h)
    return () => window.removeEventListener('keydown',h)
  }, [showMarcar, marcarFunc, marcarNum])

  const process = useCallback(async (val,isRfid=false) => {
    const v = val.replace(/[^\x21-\x7E]/g,'').trim(); if(!v) return
    // Verifica horário em tempo real via s (sempre a prop atualizada)
    const currentMeal = getMeal({...DEFAULTS,...settings})
    if(!currentMeal) return   // cantina encerrada
    setNumInput('')
    const func = isRfid
      ? funcionarios.find(f=>f.rfid===v)
      : funcionarios.find(f=>f.numero===v||f.numero===v.padStart(3,'0'))
    if(!func){setStatus({type:'error',msg:'Funcionário não encontrado'});setTimeout(reset,3000);return}
    const ementa = ementas.find(e=>e.data===TODAY&&e.tipo===currentMeal)
    if(!ementa){setStatus({type:'error',msg:'Sem ementa para este momento'});setTimeout(reset,3000);return}
    const{data:exC}=await supabase.from('cantina_consumos').select('prato_num,validado_em').eq('funcionario_id',func.id).eq('ementa_id',ementa.id).maybeSingle()
    if(exC){const pk=`prato${exC.prato_num}`;setStatus({type:'dup',func,pratoNum:exC.prato_num,pratoLabel:ementa[pk+'_label'],pratoDesc:ementa[pk+'_desc'],validadoEm:exC.validado_em});setTimeout(reset,parseInt(s.validacao_tempo_dup)*1000);return}
    const{data:marc}=await supabase.from('cantina_marcacoes').select('prato_num').eq('funcionario_id',func.id).eq('ementa_id',ementa.id).maybeSingle()
    if(!marc){setStatus({type:'no-marc',func,ementa});return}
    confirmarConsumo(func,ementa,marc.prato_num)
  },[funcionarios,ementas,settings])

  // Mantém processRef sempre atualizado
  useEffect(() => { processRef.current = process }, [process])

  // HID fallback
  const rfidRef=useRef(''); const rfidTimer=useRef(null)
  useEffect(() => {
    if(status?.type==='no-marc' || showMarcar || showDesmarcar) return // modais com teclado próprio
    const h = e => {
      if(e.key==='Enter'){if(rfidRef.current){process(rfidRef.current,true);rfidRef.current=''}return}
      if(e.key.length!==1) return
      rfidRef.current+=e.key; clearTimeout(rfidTimer.current)
      rfidTimer.current=setTimeout(()=>{rfidRef.current=''},200)
    }
    window.addEventListener('keydown',h)
    return()=>{window.removeEventListener('keydown',h);clearTimeout(rfidTimer.current)}
  },[status,process,showMarcar,showDesmarcar])

  const next = getNextMeal(s)

  // ── Modo manual: mesmo invólucro do login dos terminais (Parte 1) ──
  if (manualMode && !status) {
    const leftPanel = (
      <div>
        <div style={{fontSize:14,fontWeight:700,color:ARR.ink3,letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:16}}>Validação manual</div>
        <div style={{fontSize:132,lineHeight:0.9,color:ARR.ink,letterSpacing:'-0.01em',marginBottom:4}}>Código.</div>
        <div style={{fontStyle:'italic',fontSize:56,lineHeight:1.05,color:ARR.ink2}}>Introduz o número do funcionário.</div>
        <div style={{marginTop:32,display:'inline-flex',alignItems:'center',gap:18,background:ARR.card,border:`1px solid ${ARR.border}`,padding:'16px 22px',borderRadius:16}}>
          <div style={{position:'relative',width:56,height:56}}>
            {[0,0.5,1].map(d=>(
              <div key={d} style={{position:'absolute',inset:0,borderRadius:'50%',border:`1.5px solid ${ARR.accent}`,animation:`ff-pulse-ring 2s ease-out ${d}s infinite`}} />
            ))}
            <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'rgba(224,203,75,0.20)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Icon name="card-tap" size={28} color={ARR.accent} />
            </div>
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:ARR.ink}}>Encosta o cartão</div>
            <div style={{fontSize:12,color:ARR.ink3,marginTop:2}}>… ou usa o teclado ao lado</div>
          </div>
        </div>
      </div>
    )
    return <LoginShell leftPanel={leftPanel} value={numInput} onChange={setNumInput} onConfirm={()=>process(numInput)} serialStatus={serialStatus}
      belowKeypad={<button onClick={()=>{setManualMode(false);setNumInput('')}} style={{width:'100%',height:48,marginTop:12,background:'transparent',border:`1px solid ${ARR.border}`,borderRadius:10,fontSize:13,color:ARR.ink3,cursor:'pointer'}}>← Voltar ao leitor</button>} />
  }

  const now = new Date()
  const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0')
  const dateStr = `${WD[now.getDay()]} ${String(now.getDate()).padStart(2,'0')} ${MN[now.getMonth()]}`
  const mealTag = meal ? (meal==='A'?'🌞 Almoço':'🌙 Jantar') : null

  const bg = !meal || !status ? V.standby
    : status.type==='ok' || status.type==='visitor-ok' ? V.ok
    : status.type==='dup'     ? V.dup
    : status.type==='no-marc' ? V.no
    : C.bg
  const glow = (status?.type==='ok' || status?.type==='visitor-ok') ? 'radial-gradient(circle at 70% 30%, rgba(52,211,153,0.32) 0%, transparent 60%)'
    : status?.type==='dup'          ? 'radial-gradient(circle at 30% 30%, rgba(251,191,36,0.28) 0%, transparent 60%)'
    : status?.type==='no-marc'      ? 'radial-gradient(circle at 70% 30%, rgba(248,113,113,0.26) 0%, transparent 60%)'
    : null
  const isStandby = !status && meal

  const renderTop = () => {
    if (status) {
      const tint = (status.type==='ok'||status.type==='visitor-ok') ? 'rgba(232,249,236,0.6)' : status.type==='dup' ? 'rgba(254,243,199,0.65)' : status.type==='no-marc' ? 'rgba(254,226,226,0.6)' : C.textMuted
      return (
        <div style={{height:46,padding:'0 28px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,position:'relative',zIndex:1,color:tint,fontSize:12}}>
          <Logo size="sm" showSub={false}/>
          <span style={{fontSize:13}}>{mealTag ? `${mealTag} · ${timeStr}` : timeStr}</span>
        </div>
      )
    }
    return (
      <div style={{height:50,padding:'0 28px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,position:'relative',zIndex:1}}>
        <Logo size="sm" showSub={false}/>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <span style={{fontSize:13,color:C.textSub}}>{mealTag?`${mealTag} · `:''}{dateStr} · <strong style={{color:C.text}}>{timeStr}</strong></span>
          {!meal
            ? <span style={{display:'inline-flex',alignItems:'center',gap:6,color:C.textMuted,fontWeight:700,fontSize:11,letterSpacing:'0.06em'}}>
                <span style={{width:7,height:7,borderRadius:'50%',background:C.textMuted}}/>LEITOR EM PAUSA
              </span>
            : serialStatus==='connected'
            ? <span style={{display:'inline-flex',alignItems:'center',gap:6,color:C.success,fontWeight:700,fontSize:11,letterSpacing:'0.06em'}}>
                <span style={{width:7,height:7,borderRadius:'50%',background:C.success,boxShadow:`0 0 6px ${C.success}`}}/>LEITOR LIGADO
              </span>
            : serialStatus==='connecting'
            ? <span style={{fontSize:11,color:C.warn,fontWeight:700,letterSpacing:'0.06em'}}>A LIGAR…</span>
            : navigator.serial
            ? <button onClick={connectSerial} style={{fontSize:12,fontWeight:600,color:C.yellow,background:C.yellow+'18',border:`1px solid ${C.yellow}55`,borderRadius:99,padding:'5px 14px',height:30,cursor:'pointer'}}>{serialStatus==='error'?'⚠ Religar':'Conectar leitor'}</button>
            : null}
          <button onClick={()=>setShowMarc(true)} style={{fontSize:12,fontWeight:600,color:C.textSub,background:'transparent',border:`1px solid ${C.border}`,borderRadius:99,padding:'5px 14px',height:30,cursor:'pointer'}}>Imprimir</button>
          <button onClick={()=>setShowMarcar(true)} style={{fontSize:12,fontWeight:600,color:C.textSub,background:'transparent',border:`1px solid ${C.border}`,borderRadius:99,padding:'5px 14px',height:30,cursor:'pointer'}}>Marcar</button>
          <button onClick={()=>setShowDesmarcar(true)} style={{fontSize:12,fontWeight:600,color:C.textSub,background:'transparent',border:`1px solid ${C.border}`,borderRadius:99,padding:'5px 14px',height:30,cursor:'pointer'}}>Desmarcar</button>
          {!isKiosk && (
            <button onClick={onBack} style={{background:'none',border:'none',color:C.textMuted,fontSize:13,cursor:'pointer'}}>← Sair</button>
          )}
        </div>
      </div>
    )
  }

  const renderMain = () => {
    // Serviço encerrado — standby neutro
    if(!meal) {
      const cur = now.getHours()*60 + now.getMinutes()
      const ended = cur > toMin(s.jantar_fim) ? {label:'jantar',hora:s.jantar_fim}
        : cur > toMin(s.almoco_fim) ? {label:'almoço',hora:s.almoco_fim} : null
      return (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',zIndex:1}}>
          <div style={{textAlign:'center'}}>
            <div style={{width:200,height:200,margin:'0 auto 36px',borderRadius:'50%',background:'rgba(108,118,128,0.10)',border:'2px solid rgba(108,118,128,0.40)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Icon name="clock" size={104} color={C.textMuted}/>
            </div>
            <div style={{fontSize:84,lineHeight:0.95,color:C.text,marginBottom:14,letterSpacing:'-0.01em'}}>Serviço encerrado</div>
            {ended && (
              <div style={{fontSize:21,color:C.textSub,lineHeight:1.5,maxWidth:620,margin:'0 auto'}}>
                O {ended.label} terminou às <strong style={{color:C.text}}>{ended.hora}</strong>.
              </div>
            )}
            <div style={{marginTop:32,display:'inline-flex',alignItems:'center',gap:16,background:C.surface,border:`1px solid ${C.border}`,borderRadius:99,padding:'14px 26px'}}>
              <span style={{fontSize:24}}>{next?.tipo==='A'?'🌞':'🌙'}</span>
              <div style={{textAlign:'left'}}>
                <div style={{fontSize:12,color:C.textMuted,letterSpacing:'0.12em',fontWeight:700,textTransform:'uppercase'}}>Próximo serviço</div>
                <div style={{fontSize:18,fontWeight:700,color:C.text,marginTop:2,whiteSpace:'nowrap'}}>
                  {next ? `${next.tipo==='A'?'Almoço':'Jantar'} · abre às ${next.hora}` : 'Reabre amanhã'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Erro — takeover simples
    if(status?.type==='error') return (
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',zIndex:1}}>
        <div style={{textAlign:'center'}}>
          <div style={{width:100,height:100,borderRadius:'50%',background:C.dangerBg,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
            <Icon name="warn" size={48} color={C.danger}/>
          </div>
          <div style={{fontSize:30,fontWeight:700,color:C.danger}}>{status.msg}</div>
        </div>
      </div>
    )

    // Sucesso — takeover verde (consumo de funcionário ou visitante)
    if(status?.type==='ok' || status?.type==='visitor-ok') {
      const isVisitor = status.type==='visitor-ok'
      const titulo = isVisitor ? `${status.qtd} VISITANTE${status.qtd>1?'S':''} REGISTADO${status.qtd>1?'S':''}` : 'CONSUMO REGISTADO'
      return (
        <div style={{flex:1,display:'flex',alignItems:'center',padding:'20px 56px 36px',gap:48,position:'relative',zIndex:1}}>
          {isVisitor
            ? <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:20,flexShrink:0,width:360}}>
                <div style={{width:220,height:220,borderRadius:'50%',background:'rgba(52,211,153,0.16)',border:'1.5px solid rgba(52,211,153,0.5)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Icon name="users" size={104} color="#34d399"/>
                </div>
                <div style={{fontSize:56,lineHeight:1,color:'#fff'}}>Visitantes</div>
              </div>
            : <Pessoa func={status.func} ring="rgba(52,211,153,0.6)" metaColor="rgba(232,249,236,0.6)"/>
          }
          <div style={{flex:1,display:'flex',flexDirection:'column',gap:24}}>
            <div style={{display:'flex',alignItems:'center',gap:22}}>
              <div style={{width:132,height:132,borderRadius:'50%',background:'#34d399',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 0 16px rgba(52,211,153,0.18), 0 24px 64px rgba(0,0,0,0.4)',flexShrink:0}}>
                <Icon name="check" size={76} color={V.ok}/>
              </div>
              <div>
                <div style={{fontSize:13,color:'rgba(232,249,236,0.65)',letterSpacing:'0.16em',fontWeight:700,marginBottom:6}}>{titulo}</div>
                <div style={{fontSize:96,lineHeight:0.9,color:'#fff'}}>Bom apetite.</div>
              </div>
            </div>
            <div style={{background:V.okCard,border:'1px solid rgba(52,211,153,0.3)',borderLeft:`6px solid ${pratoColors(status.pratoNum).fg}`,borderRadius:22,padding:'24px 28px',marginTop:6}}>
              <div style={{display:'flex',alignItems:'center',gap:18,marginBottom:6}}>
                <PratoTag slot={status.pratoNum} label={status.pratoLabel} large/>
                <span style={{fontSize:13,color:'rgba(232,249,236,0.5)',letterSpacing:'0.14em',fontWeight:700}}>· {isVisitor?'PRATO':'O TEU PRATO'}</span>
              </div>
              <div style={{fontSize:42,lineHeight:1.1,color:'#fff',marginTop:8}}>{status.pratoDesc}</div>
            </div>
          </div>
        </div>
      )
    }

    // Duplicado — takeover âmbar
    if(status?.type==='dup') {
      const mins = status.validadoEm ? Math.max(0,Math.round((Date.now()-new Date(status.validadoEm).getTime())/60000)) : null
      return (
        <div style={{flex:1,display:'flex',alignItems:'center',padding:'20px 56px 36px',gap:48,position:'relative',zIndex:1}}>
          <Pessoa func={status.func} ring="rgba(251,191,36,0.55)" metaColor="rgba(254,243,199,0.6)"/>
          <div style={{flex:1,display:'flex',flexDirection:'column',gap:24}}>
            <div style={{display:'flex',alignItems:'center',gap:22}}>
              <div style={{width:132,height:132,borderRadius:'50%',background:'#fbbf24',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 0 16px rgba(251,191,36,0.18), 0 24px 64px rgba(0,0,0,0.4)',flexShrink:0}}>
                <Icon name="warn" size={70} color={V.dup}/>
              </div>
              <div>
                <div style={{fontSize:13,color:'rgba(254,243,199,0.65)',letterSpacing:'0.16em',fontWeight:700,marginBottom:6}}>JÁ FOI VALIDADA</div>
                <div style={{fontSize:84,lineHeight:0.9,color:'#fff'}}>Calma aí.</div>
              </div>
            </div>
            <div style={{background:V.dupCard,border:'1px solid rgba(251,191,36,0.28)',borderRadius:22,padding:'24px 28px'}}>
              {status.validadoEm && (
                <div style={{fontSize:13,color:'rgba(254,243,199,0.55)',letterSpacing:'0.14em',fontWeight:700,marginBottom:6}}>
                  REGISTADA ÀS {fmtHM(status.validadoEm)}{mins!=null ? ` · HÁ ${mins} ${mins===1?'MINUTO':'MINUTOS'}` : ''}
                </div>
              )}
              <div style={{display:'flex',alignItems:'center',gap:18,marginTop:10}}>
                <PratoTag slot={status.pratoNum} label={status.pratoLabel} large/>
                <div style={{fontSize:32,color:'#fff',lineHeight:1.1}}>{status.pratoDesc}</div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Sem marcação — takeover vermelho + seleção de prato
    if(status?.type==='no-marc') return (
      <div style={{flex:1,display:'flex',alignItems:'center',padding:'16px 48px 28px',gap:40,position:'relative',zIndex:1}}>
        <Pessoa func={status.func} ring="rgba(248,113,113,0.55)" avatar={180} font={52} width={300} metaColor="rgba(254,226,226,0.6)"/>
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:18}}>
          <div style={{display:'flex',alignItems:'center',gap:18}}>
            <div style={{width:96,height:96,borderRadius:'50%',background:'#f87171',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 0 12px rgba(248,113,113,0.16), 0 16px 48px rgba(0,0,0,0.4)',flexShrink:0}}>
              <Icon name="x" size={54} color={V.no}/>
            </div>
            <div>
              <div style={{fontSize:12,color:'rgba(254,226,226,0.6)',letterSpacing:'0.16em',fontWeight:700,marginBottom:4}}>SEM MARCAÇÃO PRÉVIA</div>
              <div style={{fontSize:56,lineHeight:0.95,color:'#fff'}}>Sem marcação.</div>
            </div>
          </div>
          <button onClick={reset}
            style={{width:'100%',minHeight:56,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,color:C.textSub,fontSize:15,fontWeight:600,cursor:'pointer'}}>
            Cancelar
          </button>
          <div style={{background:V.noCard,border:'1px solid rgba(248,113,113,0.22)',borderRadius:20,padding:'18px 20px'}}>
            <div style={{fontSize:11,fontWeight:700,color:'rgba(254,226,226,0.65)',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:12}}>Escolhe o prato a servir</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[1,2,3,4].map(n => {
                const label = status.ementa[`prato${n}_label`]
                const desc  = status.ementa[`prato${n}_desc`]
                if(!label) return null
                return (
                  <button key={n} onClick={()=>confirmarConsumo(status.func,status.ementa,n)}
                    style={{textAlign:'left',cursor:'pointer',background:V.noBtn,border:'1px solid rgba(248,113,113,0.18)',borderRadius:14,padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
                    <PratoTag slot={n} label={label}/>
                    <div style={{fontSize:14,lineHeight:1.3,color:'#fff',fontWeight:500,textWrap:'pretty'}}>{desc}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )

    // Visitantes — seleção de prato + quantidade
    if(visitorMode) return (
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',zIndex:1,padding:'20px 56px'}}>
        <div style={{width:'100%',maxWidth:640,background:V.panel,border:`1px solid ${C.border}`,borderRadius:24,padding:'32px 36px',display:'flex',flexDirection:'column',gap:22}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:C.textMuted,letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:6}}>Visitantes{mealTag?` · ${mealTag}`:''}</div>
            <div style={{fontSize:40,lineHeight:1,color:C.text}}>Registar consumo</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[1,2,3,4].map(n => {
              const label = ementaAtual?.[`prato${n}_label`]
              const desc  = ementaAtual?.[`prato${n}_desc`]
              if(!label) return null
              return <PratoBtn key={n} slot={n} label={label} desc={desc} selected={visitorPrato===n} onClick={()=>setVisitorPrato(n)}/>
            })}
          </div>
          {visitorPrato && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:28,padding:'18px 0'}}>
              <button onClick={()=>setVisitorQtd(q=>Math.max(1,q-1))}
                style={{width:64,height:64,borderRadius:16,background:C.surface2,border:`1px solid ${C.border}`,color:C.text,fontSize:32,fontWeight:700,cursor:'pointer'}}>−</button>
              <div style={{fontSize:56,fontWeight:900,color:C.yellow,minWidth:80,textAlign:'center'}}>{visitorQtd}</div>
              <button onClick={()=>setVisitorQtd(q=>Math.min(50,q+1))}
                style={{width:64,height:64,borderRadius:16,background:C.surface2,border:`1px solid ${C.border}`,color:C.text,fontSize:32,fontWeight:700,cursor:'pointer'}}>+</button>
            </div>
          )}
          <div style={{display:'flex',gap:12,marginTop:4}}>
            <button onClick={cancelVisitorMode}
              style={{flex:1,height:52,background:'transparent',border:`1px solid ${C.border}`,borderRadius:12,color:C.textSub,fontSize:15,fontWeight:600,cursor:'pointer'}}>
              Cancelar
            </button>
            <button disabled={!visitorPrato || !ementaAtual} onClick={confirmarVisitantes}
              style={{flex:2,height:52,background:visitorPrato?C.yellow:C.surface2,border:'none',borderRadius:12,color:visitorPrato?C.bg:C.textMuted,fontSize:15,fontWeight:700,cursor:visitorPrato?'pointer':'default'}}>
              Confirmar
            </button>
          </div>
        </div>
      </div>
    )

    // Standby — hero + últimas validações
    return (
      <div style={{flex:1,display:'flex',minHeight:0,position:'relative',zIndex:1}}>
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{textAlign:'center'}}>
            <div style={{position:'relative',width:280,height:280,margin:'0 auto 28px'}}>
              {[0,0.7,1.4].map(d => (
                <div key={d} style={{position:'absolute',inset:0,borderRadius:'50%',border:`2px solid ${C.yellow}`,animation:`ff-pulse-ring 2.4s ease-out ${d}s infinite`}} />
              ))}
              <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'radial-gradient(circle at center, rgba(224,203,75,0.18) 0%, rgba(224,203,75,0.02) 70%)',border:'2px solid rgba(224,203,75,0.50)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon name="card-tap" size={140} color={C.yellow}/>
              </div>
            </div>
            <div style={{fontSize:72,lineHeight:0.95,color:C.text,letterSpacing:'-0.01em'}}>Encosta o cartão</div>
            <button onClick={()=>setManualMode(true)}
              style={{marginTop:32,height:54,padding:'0 30px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:99,color:C.textSub,fontSize:15,fontWeight:600,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:10,transition:'border-color 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=`${C.yellow}55`;e.currentTarget.style.color=C.text}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textSub}}>
              Introduzir código manualmente
            </button>
            <button onClick={()=>setVisitorMode(true)}
              style={{marginTop:12,height:54,padding:'0 30px',background:'transparent',border:`1px solid ${C.border}`,borderRadius:99,color:C.textMuted,fontSize:15,fontWeight:600,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:10,transition:'border-color 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=`${C.yellow}55`;e.currentTarget.style.color=C.text}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textMuted}}>
              Registar visitante(s)
            </button>
          </div>
        </div>
        <div style={{width:300,background:V.panel,borderLeft:`1px solid ${C.border}`,display:'flex',flexDirection:'column',flexShrink:0}}>
          <div style={{padding:'16px 20px 12px',fontSize:11,fontWeight:700,color:C.textMuted,letterSpacing:'0.14em',textTransform:'uppercase',borderBottom:`1px solid ${C.border}`}}>Últimas validações</div>
          {recentes.length===0
            ? <div style={{padding:32,textAlign:'center',color:C.textMuted,fontSize:13}}>Sem validações</div>
            : recentes.map((r,i) => {
              return (
                <div key={r.id} style={{padding:'12px 8px 12px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:12,background:i===0?V.panelHi:'transparent'}}>
                  {r.isVisitante
                    ? <div style={{width:36,height:36,borderRadius:'50%',background:C.surface2,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <Icon name="users" size={18} color={C.textMuted}/>
                      </div>
                    : <Avatar nome={r.nome} foto={r.foto} size={36}/>
                  }
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
                      {r.isVisitante ? 'Visitantes' : r.nome}
                      {r.isVisitante && <span style={{fontSize:11,fontWeight:800,color:C.yellow}}>×{r.quantidade}</span>}
                    </div>
                    <div style={{fontSize:11,color:C.textMuted,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {fmtHM(r.validado_em)} · {r.pratoDesc}
                    </div>
                  </div>
                  <span style={{flexShrink:0}}><PratoTag slot={r.pratoNum} label={r.pratoLabel?.slice(0,3)}/></span>
                  <button onClick={()=>setAnularAlvo(r)} aria-label="Anular validação"
                    style={{width:44,height:44,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'none',borderRadius:8,color:C.textMuted,fontSize:14,lineHeight:1,cursor:'pointer'}}
                    onTouchStart={e=>{e.currentTarget.style.color=C.danger}}
                    onTouchEnd={e=>{e.currentTarget.style.color=C.textMuted}}>
                    ✕
                  </button>
                </div>
              )
            })}
        </div>
      </div>
    )
  }

  return (
    <div style={{height:'100vh',background:bg,color:C.text,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
      {glow && <div style={{position:'absolute',inset:0,pointerEvents:'none',background:glow}} />}
      {renderTop()}
      {renderMain()}
      {isStandby && contadores.length>0 && (
        <div style={{borderTop:`1px solid ${C.border}`,background:V.panel,padding:'14px 28px',display:'flex',alignItems:'center',gap:14,flexShrink:0,position:'relative',zIndex:1}}>
          <div style={{fontSize:11,color:C.textMuted,fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase'}}>Faltam servir</div>
          {contadores.map(c => {
            const p = pratoColors(c.n)
            return (
              <div key={c.n} onClick={()=>setFaltamModal({n:c.n,label:c.label})}
                style={{display:'flex',alignItems:'center',gap:12,padding:'8px 14px',background:p.bg,border:`1px solid ${p.bd}`,borderRadius:99,flex:1,justifyContent:'space-between',cursor:'pointer'}}>
                <PratoTag slot={c.n} label={c.label}/>
                <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                  <span style={{fontSize:28,fontWeight:900,color:p.fg,lineHeight:1}}>{c.left}</span>
                  <span style={{fontSize:12,color:C.textMuted}}>/ {c.total}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {showMarc && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{width:480,maxWidth:'92vw',background:V.panel,border:`1px solid ${C.border}`,borderRadius:20,padding:28,display:'flex',flexDirection:'column',gap:22}}>
            <div style={{fontSize:22,fontWeight:700,color:C.text}}>Imprimir marcações</div>

            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.textMuted,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:10}}>Período</div>
              <div style={{display:'flex',gap:8}}>
                {[['hoje','Hoje'],['amanha','Amanhã'],['entre','Entre datas']].map(([v,label]) => (
                  <button key={v} onClick={()=>setMarcPeriodo(v)}
                    style={{flex:1,minHeight:56,borderRadius:12,cursor:'pointer',fontSize:14,fontWeight:600,
                      background:marcPeriodo===v?C.yellow:C.surface2,color:marcPeriodo===v?C.bg:C.textSub,
                      border:`1px solid ${marcPeriodo===v?C.yellow:C.border}`}}>{label}</button>
                ))}
              </div>
              {marcPeriodo==='entre' && (
                <div style={{display:'flex',gap:10,marginTop:12}}>
                  <label style={{flex:1,display:'flex',flexDirection:'column',gap:4,fontSize:12,color:C.textMuted}}>De
                    <input type="date" value={marcDe} onChange={e=>setMarcDe(e.target.value)}
                      style={{minHeight:56,borderRadius:10,border:`1px solid ${C.border}`,background:C.surface2,color:C.text,padding:'0 12px',fontSize:14}}/>
                  </label>
                  <label style={{flex:1,display:'flex',flexDirection:'column',gap:4,fontSize:12,color:C.textMuted}}>Até
                    <input type="date" value={marcAte} onChange={e=>setMarcAte(e.target.value)}
                      style={{minHeight:56,borderRadius:10,border:`1px solid ${C.border}`,background:C.surface2,color:C.text,padding:'0 12px',fontSize:14}}/>
                  </label>
                </div>
              )}
            </div>

            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.textMuted,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:10}}>Refeição</div>
              <div style={{display:'flex',gap:8}}>
                {[['A','Almoço'],['J','Jantar'],['ambos','Ambos']].map(([v,label]) => (
                  <button key={v} onClick={()=>setMarcRefeicao(v)}
                    style={{flex:1,minHeight:56,borderRadius:12,cursor:'pointer',fontSize:14,fontWeight:600,
                      background:marcRefeicao===v?C.yellow:C.surface2,color:marcRefeicao===v?C.bg:C.textSub,
                      border:`1px solid ${marcRefeicao===v?C.yellow:C.border}`}}>{label}</button>
                ))}
              </div>
            </div>

            <div style={{display:'flex',gap:12,marginTop:6}}>
              <button onClick={()=>setShowMarc(false)}
                style={{flex:1,minHeight:56,background:'transparent',border:`1px solid ${C.border}`,borderRadius:12,color:C.textSub,fontSize:15,fontWeight:600,cursor:'pointer'}}>
                Cancelar
              </button>
              <button onClick={imprimirMarcacoes}
                style={{flex:2,minHeight:56,background:C.yellow,border:'none',borderRadius:12,color:C.bg,fontSize:15,fontWeight:700,cursor:'pointer'}}>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
      {faltamModal && (() => {
        const lista = faltamPorPrato(faltamModal.n)
        return (
          <div onClick={()=>setFaltamModal(null)}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div onClick={e=>e.stopPropagation()}
              style={{width:480,maxWidth:'92vw',maxHeight:'90vh',background:V.panel,border:`1px solid ${C.border}`,borderRadius:20,padding:28,display:'flex',flexDirection:'column',gap:18}}>
              <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                <PratoTag slot={faltamModal.n} label={faltamModal.label} large/>
              </div>
              <div style={{fontSize:20,fontWeight:700,color:C.text,flexShrink:0}}>Faltam servir {lista.length} colaborador{lista.length===1?'':'es'}</div>
              <div style={{maxHeight:'calc(100vh - 240px)',overflowY:'auto',display:'flex',flexDirection:'column',gap:8}}>
                {lista.length===0
                  ? <div style={{padding:24,textAlign:'center',color:C.textMuted,fontSize:13}}>Ninguém por servir</div>
                  : lista.map(f => (
                    <div key={f.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12}}>
                      <Avatar nome={f.nome} foto={f.foto} size={40}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.nome}</div>
                        <div style={{fontSize:12,color:C.textMuted}}>Nº {f.numero}</div>
                      </div>
                    </div>
                  ))}
              </div>
              <button onClick={()=>setFaltamModal(null)}
                style={{width:'100%',minHeight:56,flexShrink:0,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,color:C.textSub,fontSize:15,fontWeight:600,cursor:'pointer'}}>
                Fechar
              </button>
            </div>
          </div>
        )
      })()}
      {anularAlvo && (
        <div onClick={()=>setAnularAlvo(null)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()}
            style={{width:400,maxWidth:'92vw',background:V.panel,border:`1px solid ${C.border}`,borderRadius:20,padding:28,display:'flex',flexDirection:'column',gap:20,alignItems:'center',textAlign:'center'}}>
            {anularAlvo.isVisitante
              ? <div style={{width:56,height:56,borderRadius:'50%',background:C.surface2,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Icon name="users" size={26} color={C.textMuted}/>
                </div>
              : <Avatar nome={anularAlvo.nome} foto={anularAlvo.foto} size={56}/>
            }
            <div style={{fontSize:16,fontWeight:700,color:C.text}}>{anularAlvo.isVisitante ? 'Visitantes' : anularAlvo.nome}</div>
            <div style={{fontSize:15,color:C.textSub}}>Anular este consumo?</div>
            <div style={{display:'flex',gap:12,width:'100%'}}>
              <button onClick={()=>setAnularAlvo(null)}
                style={{flex:1,minHeight:56,background:'transparent',border:`1px solid ${C.border}`,borderRadius:12,color:C.textSub,fontSize:15,fontWeight:600,cursor:'pointer'}}>
                Cancelar
              </button>
              <button onClick={anularConsumo}
                style={{flex:1,minHeight:56,background:C.danger,border:'none',borderRadius:12,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer'}}>
                Confirmar anulação
              </button>
            </div>
          </div>
        </div>
      )}
      {showDesmarcar && (() => {
        const q = desmarcarQuery.trim().toLowerCase()
        const resultados = q.length===0 ? [] : funcionarios.filter(f=>f.ativo && (f.nome.toLowerCase().includes(q) || f.numero.includes(q))).slice(0,20)
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{width:480,maxWidth:'92vw',maxHeight:'90vh',background:V.panel,border:`1px solid ${C.border}`,borderRadius:20,padding:28,display:'flex',flexDirection:'column',gap:18}}>
              <div style={{fontSize:22,fontWeight:700,color:C.text,flexShrink:0}}>Desmarcar</div>

              {!desmarcarFunc ? (
                <>
                  <div style={{background:ARR.card,border:`1px solid ${ARR.border}`,borderRadius:14,height:56,display:'flex',alignItems:'center',padding:'0 16px',flexShrink:0}}>
                    <span style={{fontSize:22,letterSpacing:2,color:desmarcarPesquisa?C.text:C.textMuted}}>{desmarcarPesquisa || 'Número do funcionário'}</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,flexShrink:0}}>
                    {[1,2,3,4,5,6,7,8,9].map(d => (
                      <button key={d} onClick={()=>setDesmarcarPesquisa(p=>p+String(d))}
                        style={{height:56,fontSize:20,fontWeight:600,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,cursor:'pointer'}}>{d}</button>
                    ))}
                    <button onClick={()=>setDesmarcarPesquisa(p=>p.slice(0,-1))}
                      style={{height:56,fontSize:18,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,color:C.textSub,cursor:'pointer'}}>⌫</button>
                    <button onClick={()=>setDesmarcarPesquisa(p=>p+'0')}
                      style={{height:56,fontSize:20,fontWeight:600,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,cursor:'pointer'}}>0</button>
                    <button onClick={executarPesquisaDesmarcar}
                      style={{height:56,fontSize:14,fontWeight:700,background:C.yellow,border:'none',borderRadius:12,color:C.bg,cursor:'pointer'}}>↵ ENTER</button>
                  </div>
                  <div style={{flex:1,minHeight:0,overflowY:'auto',display:'flex',flexDirection:'column',gap:8}}>
                    {q.length===0
                      ? <div style={{padding:24,textAlign:'center',color:C.textMuted,fontSize:13}}>Escreve para pesquisar</div>
                      : resultados.length===0
                      ? <div style={{padding:24,textAlign:'center',color:C.textMuted,fontSize:13}}>Sem resultados</div>
                      : resultados.map(f => (
                        <button key={f.id} onClick={()=>selecionarFuncDesmarcar(f)}
                          style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,cursor:'pointer',textAlign:'left'}}>
                          <Avatar nome={f.nome} foto={f.foto} size={40}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:14,fontWeight:700,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.nome}</div>
                            <div style={{fontSize:12,color:C.textMuted}}>Nº {f.numero}</div>
                          </div>
                        </button>
                      ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                    <Avatar nome={desmarcarFunc.nome} foto={desmarcarFunc.foto} size={40}/>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:C.text}}>{desmarcarFunc.nome}</div>
                      <div style={{fontSize:12,color:C.textMuted}}>Nº {desmarcarFunc.numero}</div>
                    </div>
                    <button onClick={()=>{setDesmarcarFunc(null);setDesmarcarMarcs(null)}}
                      style={{marginLeft:'auto',fontSize:12,color:C.textSub,background:'transparent',border:`1px solid ${C.border}`,borderRadius:99,padding:'5px 12px',cursor:'pointer'}}>
                      Trocar
                    </button>
                  </div>
                  <div style={{flex:1,minHeight:0,overflowY:'auto',display:'flex',flexDirection:'column',gap:10}}>
                    {desmarcarMarcs===null
                      ? <div style={{padding:24,textAlign:'center',color:C.textMuted,fontSize:13}}>A carregar…</div>
                      : desmarcarMarcs.length===0
                      ? <div style={{padding:24,textAlign:'center',color:C.textMuted,fontSize:13}}>Sem marcações por cancelar</div>
                      : desmarcarMarcs.map(m => (
                        <div key={m.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:C.text}}>{m.tipo==='A'?'Almoço':'Jantar'} · {m.data===TODAY?'Hoje':fmtS(m.data)}</div>
                            <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>{m.pratoLabel}</div>
                          </div>
                          <button onClick={()=>setDesmarcarConfirm(m)}
                            style={{height:48,padding:'0 16px',background:C.danger,border:'none',borderRadius:10,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',flexShrink:0}}>
                            Cancelar marcação
                          </button>
                        </div>
                      ))}
                  </div>
                </>
              )}

              <button onClick={fecharDesmarcar}
                style={{width:'100%',minHeight:56,flexShrink:0,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,color:C.textSub,fontSize:15,fontWeight:600,cursor:'pointer'}}>
                Fechar
              </button>
            </div>
          </div>
        )
      })()}
      {showMarcar && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{width:480,maxWidth:'92vw',maxHeight:'90vh',background:V.panel,border:`1px solid ${C.border}`,borderRadius:20,padding:28,display:'flex',flexDirection:'column',gap:18}}>
            <div style={{fontSize:22,fontWeight:700,color:C.text,flexShrink:0}}>Marcar</div>

            {!marcarFunc ? (
              <>
                <div style={{background:ARR.card,border:`1px solid ${ARR.border}`,borderRadius:14,height:56,display:'flex',alignItems:'center',padding:'0 16px',flexShrink:0}}>
                  <span style={{fontSize:22,letterSpacing:2,color:marcarNum?C.text:C.textMuted}}>{marcarNum || 'Número do funcionário'}</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,flexShrink:0}}>
                  {[1,2,3,4,5,6,7,8,9].map(d => (
                    <button key={d} onClick={()=>digitarMarcar(p=>p.length<10?p+String(d):p)}
                      style={{height:56,fontSize:20,fontWeight:600,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,cursor:'pointer'}}>{d}</button>
                  ))}
                  <button onClick={()=>digitarMarcar(p=>p.slice(0,-1))}
                    style={{height:56,fontSize:18,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,color:C.textSub,cursor:'pointer'}}>⌫</button>
                  <button onClick={()=>digitarMarcar(p=>p.length<10?p+'0':p)}
                    style={{height:56,fontSize:20,fontWeight:600,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,cursor:'pointer'}}>0</button>
                  <button onClick={executarPesquisaMarcar}
                    style={{height:56,fontSize:14,fontWeight:700,background:C.yellow,border:'none',borderRadius:12,color:C.bg,cursor:'pointer'}}>↵ ENTER</button>
                </div>
                {marcarFunc===false && (
                  <div style={{padding:12,textAlign:'center',color:C.danger,fontSize:14,fontWeight:600}}>Funcionário não encontrado</div>
                )}
              </>
            ) : (
              <>
                <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                  <Avatar nome={marcarFunc.nome} foto={marcarFunc.foto} size={40}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:700,color:C.text}}>{marcarFunc.nome}</div>
                    <div style={{fontSize:12,color:C.textMuted}}>Nº {marcarFunc.numero}</div>
                  </div>
                  <button onClick={()=>{setMarcarFunc(null);setMarcarRefs(null);setMarcarEm(null);setMarcarErro('')}}
                    style={{marginLeft:'auto',fontSize:12,color:C.textSub,background:'transparent',border:`1px solid ${C.border}`,borderRadius:99,padding:'5px 12px',cursor:'pointer'}}>
                    Trocar
                  </button>
                </div>
                <div style={{flex:1,minHeight:0,overflowY:'auto',display:'flex',flexDirection:'column',gap:10}}>
                  {marcarRefs===null
                    ? <div style={{padding:24,textAlign:'center',color:C.textMuted,fontSize:13}}>A carregar…</div>
                    : marcarRefs.length===0
                    ? <div style={{padding:24,textAlign:'center',color:C.textMuted,fontSize:13}}>Todas as refeições de hoje já estão marcadas</div>
                    : !marcarEm
                    ? <div style={{display:'flex',gap:10}}>
                        {marcarRefs.map(em => (
                          <button key={em.id} onClick={()=>setMarcarEm(em)}
                            style={{flex:1,minHeight:64,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:16,fontWeight:700,cursor:'pointer'}}>
                            {em.tipo==='A'?'Almoço':'Jantar'}
                          </button>
                        ))}
                      </div>
                    : <>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <div style={{fontSize:12,fontWeight:700,color:C.textMuted,letterSpacing:'0.14em',textTransform:'uppercase'}}>{marcarEm.tipo==='A'?'Almoço':'Jantar'} · escolhe o prato</div>
                          <button onClick={()=>{setMarcarEm(null);setMarcarErro('')}}
                            style={{fontSize:12,color:C.textSub,background:'transparent',border:`1px solid ${C.border}`,borderRadius:99,padding:'5px 12px',cursor:'pointer'}}>
                            Voltar
                          </button>
                        </div>
                        {[1,2,3,4].map(n => {
                          const label = marcarEm[`prato${n}_label`]
                          if(!label) return null
                          return <PratoBtn key={n} slot={n} label={label} desc={marcarEm[`prato${n}_desc`]} onClick={()=>marcarPrato(n)}/>
                        })}
                      </>}
                  {marcarErro && <div style={{textAlign:'center',color:C.danger,fontSize:13,fontWeight:600}}>{marcarErro}</div>}
                </div>
              </>
            )}

            <button onClick={fecharMarcar}
              style={{width:'100%',minHeight:56,flexShrink:0,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,color:C.textSub,fontSize:15,fontWeight:600,cursor:'pointer'}}>
              Fechar
            </button>
          </div>
        </div>
      )}
      {desmarcarConfirm && (
        <div onClick={()=>setDesmarcarConfirm(null)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()}
            style={{width:400,maxWidth:'92vw',background:V.panel,border:`1px solid ${C.border}`,borderRadius:20,padding:28,display:'flex',flexDirection:'column',gap:20,alignItems:'center',textAlign:'center'}}>
            <Avatar nome={desmarcarFunc.nome} foto={desmarcarFunc.foto} size={56}/>
            <div style={{fontSize:16,fontWeight:700,color:C.text}}>{desmarcarFunc.nome}</div>
            <div style={{fontSize:15,color:C.textSub}}>Cancelar esta marcação?</div>
            <div style={{display:'flex',gap:12,width:'100%'}}>
              <button onClick={()=>setDesmarcarConfirm(null)}
                style={{flex:1,minHeight:56,background:'transparent',border:`1px solid ${C.border}`,borderRadius:12,color:C.textSub,fontSize:15,fontWeight:600,cursor:'pointer'}}>
                Cancelar
              </button>
              <button onClick={cancelarMarcacao}
                style={{flex:1,minHeight:56,background:C.danger,border:'none',borderRadius:12,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer'}}>
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
