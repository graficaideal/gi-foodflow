import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchDiasFechados, setDiaFechado, unsetDiaFechado } from '../../lib/queries'
import { C } from '../../constants/colors'
import { pratoColors, PRATO_GLYPHS, SLOT4_LABELS } from '../../constants/pratos'
import { MN, TODAY } from '../../utils/date'
import { fmtHorario } from '../../utils/meal'
import { DEFAULTS } from '../../constants/settings'
import { weekDays, isoWeekNum, slotLabels, newEmentaRow } from '../../utils/ementaGrid'
import Icon from '../../components/Icon'

const MEALS = [{tipo:'A',label:'Almoço',icon:'sun'},{tipo:'J',label:'Jantar',icon:'moon'}]
const SLOTS = [1,2,3,4]
const ROWS = MEALS.flatMap(m => SLOTS.map(n => `${m.tipo}-${n}`))   // ordem vertical para Enter/↑/↓
const GRID = '208px repeat(5, minmax(0,1fr))'
const WD3 = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB']
const SUBTLE = 'rgba(45,55,72,0.6)'
const ACCENT_MUTED = 'rgba(224,203,75,0.12)'
const CLOSED = '#fb923c'

const isPast = d => d < TODAY
const keyOf = (data,tipo) => `${data}-${tipo}`
const dayLabel = d => { const x = new Date(d+'T12:00:00'); return `${String(x.getDate()).padStart(2,'0')} ${MN[x.getMonth()].toLowerCase()}` }
const fmtRange = days => {
  const a = new Date(days[0]+'T12:00:00'), b = new Date(days[4]+'T12:00:00')
  return `${a.getMonth()===b.getMonth() ? String(a.getDate()).padStart(2,'0') : dayLabel(days[0])} – ${dayLabel(days[4])} ${b.getFullYear()}`
}
const nowHM = () => new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})

export default function SecEmentas({ementas,reload,marcacoesAll=[],settings}) {
  const s = {...DEFAULTS,...settings}
  const [weekOffset,setWeekOffset] = useState(0)
  const [rows,setRows] = useState(ementas)                 // cópia local para atualização otimista
  const [draft,setDraft] = useState({})                    // { [`${data}-${tipo}-${n}`]: texto } em edição
  const [labelDraft,setLabelDraft] = useState({})          // { [`${tipo}-${n}`]: texto } em edição
  const [labelMem,setLabelMem] = useState({})              // labels editadas numa semana sem ementas desse tipo
  const [focusId,setFocusId] = useState(null)
  const [errCells,setErrCells] = useState({})
  const [saveState,setSaveState] = useState({status:'idle',at:null})
  const [diasFechados,setDiasFechados] = useState([])
  const refs = useRef({})
  const rowsRef = useRef(rows); rowsRef.current = rows
  const idsRef = useRef({})                                // ids devolvidos por inserts ainda não refletidos em rows
  const queue = useRef(Promise.resolve())                  // ponytail: fila global; evita inserts duplicados da mesma ementa
  const pending = useRef(0)

  useEffect(() => { if (!pending.current) setRows(ementas) }, [ementas])
  useEffect(() => { fetchDiasFechados().then(setDiasFechados) }, [])
  useEffect(() => { setLabelMem({}) }, [weekOffset])

  const days = weekDays(TODAY, weekOffset)
  const byKey = useMemo(() => new Map(rows.map(e => [keyOf(e.data,e.tipo), e])), [rows])
  const findEm = (data,tipo) => byKey.get(keyOf(data,tipo))
  const marcCount = useMemo(() => {
    const m = new Map()
    for (const x of marcacoesAll) { const k = `${x.ementa_id}-${x.prato_num}`; m.set(k,(m.get(k)||0)+1) }
    return m
  }, [marcacoesAll])
  const marcsOf = (em,n) => em?.id ? marcCount.get(`${em.id}-${n}`) || 0 : 0

  const labels = Object.fromEntries(MEALS.map(({tipo}) => {
    const week = days.map(d => findEm(d,tipo)).filter(Boolean)
    const base = slotLabels(week, isPast, rows.filter(e => e.tipo===tipo))
    return [tipo, base.map((l,i) => labelMem[`${tipo}-${i+1}`] ?? l)]
  }))

  const toggleDia = async date => {
    const isClosed = diasFechados.includes(date)
    setDiasFechados(p => isClosed ? p.filter(d=>d!==date) : [...p,date])
    const {error} = isClosed ? await unsetDiaFechado(date) : await setDiaFechado(date)
    if (error) {
      setDiasFechados(p => isClosed ? [...p,date] : p.filter(d=>d!==date))
      console.error('toggleDia:', error)
    }
  }

  // Aplica `patch` às ementas `targets` ({data,tipo}): otimista já, Supabase em fila.
  // Ementa inexistente → insert com as labels atuais. Em erro reverte e, se `cell`, devolve o texto à célula.
  const save = (targets, patch, cell) => {
    const fields = Object.keys(patch)
    const prev = new Map(targets.map(t => {
      const em = findEm(t.data,t.tipo)
      return [keyOf(t.data,t.tipo), em ? Object.fromEntries(fields.map(f => [f, em[f]])) : null]
    }))
    const tLabels = Object.fromEntries(targets.map(t => [keyOf(t.data,t.tipo), labels[t.tipo]]))
    setRows(p => {
      const next = p.map(e => prev.has(keyOf(e.data,e.tipo)) ? {...e,...patch} : e)
      for (const t of targets) if (!prev.get(keyOf(t.data,t.tipo))) next.push({id:null,...newEmentaRow(t.data,t.tipo,tLabels[keyOf(t.data,t.tipo)]),...patch})
      return next
    })
    if (cell) setErrCells(e => { const n = {...e}; delete n[cell.id]; return n })
    pending.current++
    setSaveState(st => ({...st,status:'saving'}))

    const idOf = t => idsRef.current[keyOf(t.data,t.tipo)] ?? rowsRef.current.find(e => e.data===t.data && e.tipo===t.tipo)?.id
    queue.current = queue.current.then(async () => {
      const ids = targets.map(idOf)
      const have = ids.filter(Boolean)
      if (have.length) {
        const {error} = await supabase.from('cantina_ementas').update(patch).in('id',have)
        if (error) throw error
      }
      for (const t of targets.filter((_,i) => !ids[i])) {
        const k = keyOf(t.data,t.tipo)
        const {data,error} = await supabase.from('cantina_ementas').insert({...newEmentaRow(t.data,t.tipo,tLabels[k]),...patch}).select().single()
        if (error) throw error
        idsRef.current[k] = data.id
        setRows(p => p.map(e => keyOf(e.data,e.tipo)===k ? {...e,id:data.id} : e))
      }
    }).then(() => {
      if (--pending.current) return
      setSaveState({status:'saved',at:nowHM()})
      reload()
    }, err => {
      console.error('SecEmentas save:', err)
      pending.current--
      setRows(p => p.flatMap(e => {
        const k = keyOf(e.data,e.tipo)
        if (!prev.has(k)) return [e]
        const old = prev.get(k)
        return old ? [{...e,...old}] : e.id ? [e] : []   // insert falhado → remove a linha temporária
      }))
      if (cell) {
        setErrCells(e => ({...e,[cell.id]:true}))
        setDraft(d => ({...d,[cell.id]:cell.text}))
      }
      setSaveState({status:'error',at:null})
    })
  }

  const blurCell = (data,tipo,n,id) => {
    setFocusId(null)
    const text = draft[id]
    if (text === undefined) return
    setDraft(d => { const x = {...d}; delete x[id]; return x })
    const v = text.trim() || null
    if (v === (findEm(data,tipo)?.[`prato${n}_desc`] || null)) return
    save([{data,tipo}], {[`prato${n}_desc`]:v}, {id,text})
  }

  const blurLabel = (tipo,n) => {
    const k = `${tipo}-${n}`
    const v = labelDraft[k]?.trim()
    setLabelDraft(d => { const x = {...d}; delete x[k]; return x })
    if (!v || v === labels[tipo][n-1]) return
    const targets = days.filter(d => !isPast(d) && findEm(d,tipo)).map(data => ({data,tipo}))
    if (targets.length) save(targets, {[`prato${n}_label`]:v})
    else setLabelMem(m => ({...m,[k]:v}))
  }

  const move = (data,tipo,n,dr) => {
    const r = ROWS[ROWS.indexOf(`${tipo}-${n}`) + dr]
    if (r) refs.current[`${data}-${r}`]?.focus()
  }
  const onKey = (e,data,tipo,n) => {
    const t = e.target
    if ((e.key==='Enter' && !e.shiftKey) || (e.key==='ArrowDown' && t.selectionStart===t.value.length)) { e.preventDefault(); move(data,tipo,n,1) }
    else if (e.key==='ArrowUp' && t.selectionStart===0 && t.selectionEnd===0) { e.preventDefault(); move(data,tipo,n,-1) }
    else if (e.key==='Escape') t.blur()
  }

  const dayStats = d => MEALS.reduce((a,{tipo}) => {
    const em = findEm(d,tipo)
    for (const n of SLOTS) {
      if (em && !em[`prato${n}_label`]) continue
      a.total++
      if (em?.[`prato${n}_desc`]) a.filled++
      a.marcs += marcsOf(em,n)
    }
    return a
  }, {filled:0,total:0,marcs:0})
  const stats = days.map(dayStats)
  const open = days.map(d => !diasFechados.includes(d))
  const weekFilled = stats.reduce((a,x,i) => a + (open[i] ? x.filled : 0), 0)
  const weekTotal  = stats.reduce((a,x,i) => a + (open[i] ? x.total : 0), 0)

  const navBtn = {width:34,height:34,borderRadius:9,background:C.surface,border:`1px solid ${C.border}`,color:C.textSub,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}

  return (
    <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column'}}>
      {/* Toolbar da semana */}
      <div style={{height:60,flexShrink:0,padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:`1px solid ${SUBTLE}`}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button title="Semana anterior" onClick={()=>setWeekOffset(o=>o-1)} style={navBtn}><Icon name="chev-l" size={16}/></button>
          <button title="Semana seguinte" onClick={()=>setWeekOffset(o=>o+1)} style={navBtn}><Icon name="chev-r" size={16}/></button>
          <span style={{fontSize:17,fontWeight:700,marginLeft:6,color:C.text}}>Semana {isoWeekNum(days[0])}</span>
          <span style={{fontSize:15,color:C.textSub}}>{fmtRange(days)}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:18,fontSize:13,color:C.textSub}}>
          <span><strong style={{color:weekTotal && weekFilled===weekTotal ? C.success : C.text}}>{weekFilled}</strong> de {weekTotal} pratos preenchidos</span>
          <span style={{width:1,height:16,background:C.border}}/>
          <span style={{display:'inline-flex',alignItems:'center',gap:6,minWidth:130}}>
            {saveState.status==='saving' && <><Icon name="clock" size={14}/>A guardar…</>}
            {saveState.status==='saved'  && <><Icon name="check" size={14} color={C.success}/>Guardado às {saveState.at}</>}
            {saveState.status==='error'  && <span style={{color:C.danger,display:'inline-flex',alignItems:'center',gap:6}}><Icon name="warn" size={14} color={C.danger}/>Erro ao guardar</span>}
          </span>
        </div>
      </div>

      {/* Folha */}
      <div style={{flex:1,minHeight:0,padding:'16px 24px 20px',display:'flex',flexDirection:'column'}}>
        <div style={{flex:1,minHeight:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {/* Cabeçalho */}
          <div style={{display:'grid',gridTemplateColumns:GRID,height:56,flexShrink:0,borderBottom:`1px solid ${C.border}`,background:C.bg}}>
            <div style={{padding:'0 16px',display:'flex',alignItems:'center',fontSize:11,fontWeight:700,letterSpacing:'0.08em',color:C.textMuted}}>PRATO</div>
            {days.map((d,i) => {
              const {filled,total,marcs} = stats[i]
              const closed = !open[i], past = isPast(d), today = d===TODAY
              return (
                <div key={d} style={{padding:'0 14px',borderLeft:`1px solid ${SUBTLE}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,background:today?ACCENT_MUTED:'transparent',opacity:past?0.6:1}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:7,minWidth:0}}>
                    {today
                      ? <span style={{fontSize:10,fontWeight:800,letterSpacing:'0.08em',padding:'2px 6px',borderRadius:5,background:C.yellow,color:'#0d1117',alignSelf:'center'}}>HOJE</span>
                      : <span style={{fontSize:12,fontWeight:700,letterSpacing:'0.06em',color:C.textMuted}}>{WD3[new Date(d+'T12:00:00').getDay()]}</span>}
                    <span style={{fontSize:18,fontWeight:800,whiteSpace:'nowrap',color:closed?C.textMuted:C.text}}>{dayLabel(d)}</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:C.textSub,whiteSpace:'nowrap',flexShrink:0}}>
                    {closed
                      ? <span style={{fontSize:10,fontWeight:800,letterSpacing:'0.08em',color:CLOSED}}>ENCERRADO</span>
                      : <span title="Pratos preenchidos" style={{fontWeight:700,color:filled===total?C.success:filled===0?C.danger:C.warn}}>{filled}/{total}</span>}
                    <span title="Marcações" style={{display:'inline-flex',alignItems:'center',gap:4}}><Icon name="users" size={13}/>{marcs}</span>
                    {!past && (
                      <button title={closed?'Reabrir dia':'Encerrar dia'} onClick={()=>toggleDia(d)} tabIndex={-1}
                        style={{width:22,height:22,borderRadius:6,border:`1px solid ${closed?CLOSED+'55':'transparent'}`,background:closed?'rgba(251,146,60,0.15)':'transparent',display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'background 0.15s, border-color 0.15s'}}>
                        <Icon name="lock" size={12} color={closed?CLOSED:C.textMuted}/>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Corpo */}
          <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column',overflowY:'auto'}}>
            {MEALS.map((m,mi) => (
              <Fragment key={m.tipo}>
                <div style={{height:34,flexShrink:0,display:'flex',alignItems:'center',gap:10,padding:'0 16px',background:C.bg,borderTop:mi?`1px solid ${C.border}`:'none',borderBottom:`1px solid ${SUBTLE}`}}>
                  <Icon name={m.icon} size={15} color={C.yellow}/>
                  <span style={{fontSize:12,fontWeight:800,letterSpacing:'0.08em',color:C.text}}>{m.label.toUpperCase()}</span>
                  <span style={{fontSize:12,color:C.textMuted}}>{fmtHorario(s,m.tipo)}</span>
                </div>
                {SLOTS.map(n => {
                  const p = pratoColors(n)
                  const lk = `${m.tipo}-${n}`
                  return (
                    <div key={n} style={{flex:1,minHeight:64,display:'grid',gridTemplateColumns:GRID,borderBottom:n<4?`1px solid ${SUBTLE}`:'none'}}>
                      {/* Coluna do slot */}
                      <div style={{display:'flex',alignItems:'center',gap:10,padding:'0 12px 0 0'}}>
                        <span style={{width:4,alignSelf:'stretch',background:p.fg}}/>
                        <span style={{color:p.fg,display:'inline-flex'}}><Icon name={PRATO_GLYPHS[n-1]} size={16}/></span>
                        {n===4
                          ? <div style={{flex:1,minWidth:0,padding:'0 8px'}}>
                              <div style={{color:p.fg,fontSize:13,fontWeight:800,letterSpacing:'0.04em'}}>VEG. / OPÇÃO</div>
                              <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Escolhe em cada dia</div>
                            </div>
                          : <input value={labelDraft[lk] ?? labels[m.tipo][n-1]} readOnly={days.every(isPast)}
                              onChange={e=>setLabelDraft(d=>({...d,[lk]:e.target.value}))} onBlur={()=>blurLabel(m.tipo,n)}
                              onKeyDown={e=>{ if (e.key==='Enter'||e.key==='Escape') e.target.blur() }}
                              style={{flex:1,minWidth:0,background:'transparent',border:'1px solid transparent',borderRadius:8,padding:'6px 8px',color:p.fg,fontSize:13,fontWeight:800,letterSpacing:'0.04em',textTransform:'uppercase',fontFamily:'inherit',transition:'border-color 0.15s'}}/>}
                      </div>

                      {/* Células dos dias */}
                      {days.map((d,di) => {
                        const id = `${d}-${m.tipo}-${n}`
                        const em = findEm(d,m.tipo)
                        const v = draft[id] ?? em?.[`prato${n}_desc`] ?? ''
                        const mc = marcsOf(em,n)
                        const on = focusId===id, err = errCells[id]
                        const locked = isPast(d) || !open[di]
                        const l4 = em?.prato4_label ?? SLOT4_LABELS[0]
                        return (
                          <div key={d} style={{position:'relative',borderLeft:`1px solid ${SUBTLE}`,transition:'background 0.15s',
                            background:on?ACCENT_MUTED:!open[di]?'rgba(251,146,60,0.04)':d===TODAY?'rgba(224,203,75,0.035)':'transparent',
                            boxShadow:err?`inset 0 0 0 2px ${C.danger}`:on?`inset 0 0 0 2px ${C.yellow}`:'none'}}>
                            <textarea ref={el=>refs.current[id]=el} value={v} rows={2} readOnly={locked} tabIndex={locked?-1:0}
                              placeholder={locked?'':'Descrição do prato'}
                              onChange={e=>setDraft(x=>({...x,[id]:e.target.value}))}
                              onFocus={()=>!locked && setFocusId(id)} onBlur={()=>!locked && blurCell(d,m.tipo,n,id)}
                              onKeyDown={e=>!locked && onKey(e,d,m.tipo,n)}
                              style={{position:'absolute',inset:0,width:'100%',height:'100%',resize:'none',background:'transparent',border:'none',outline:'none',
                                padding:n===4?'34px 12px 8px':'9px 12px',paddingRight:mc?44:12,color:locked?C.textSub:C.text,
                                fontSize:13.5,lineHeight:1.35,fontFamily:'inherit',cursor:locked?'default':'text',overflow:'hidden'}}/>
                            {n===4 && (
                              <div style={{position:'absolute',top:7,left:10,display:'flex',padding:2,gap:2,borderRadius:8,background:C.bg,border:`1px solid ${SUBTLE}`,zIndex:1}}>
                                {SLOT4_LABELS.map(o => {
                                  const act = l4===o
                                  return (
                                    <button key={o} disabled={locked} tabIndex={-1} onClick={()=>!act && save([{data:d,tipo:m.tipo}],{prato4_label:o})}
                                      style={{height:20,padding:'0 8px',borderRadius:6,border:'none',cursor:locked||act?'default':'pointer',fontFamily:'inherit',fontSize:10.5,fontWeight:800,letterSpacing:'0.04em',
                                        background:act?p.bg:'transparent',color:act?p.fg:C.textMuted,boxShadow:act?`inset 0 0 0 1px ${p.bd}`:'none',opacity:locked&&!act?0.4:1,transition:'background 0.15s'}}>
                                      {o.toUpperCase()}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                            {mc>0 && <span title={`${mc} marcações`} style={{position:'absolute',top:8,right:8,minWidth:24,height:20,padding:'0 6px',borderRadius:20,background:'rgba(52,211,153,0.14)',color:C.success,fontSize:11,fontWeight:800,display:'inline-flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>{mc}</span>}
                            {!v && !locked && !on && <span style={{position:'absolute',left:12,bottom:8,width:6,height:6,borderRadius:'50%',background:C.warn,pointerEvents:'none'}}/>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>

        {/* Legenda */}
        <div style={{display:'flex',gap:18,marginTop:10,fontSize:12,color:C.textMuted,flexShrink:0}}>
          <span><b style={{color:C.textSub}}>Enter</b> ou <b style={{color:C.textSub}}>↓</b> próximo prato</span>
          <span><b style={{color:C.textSub}}>Tab</b> dia seguinte</span>
          <span><b style={{color:C.textSub}}>Esc</b> sair da célula</span>
          <span>As alterações são guardadas ao sair de cada célula.</span>
        </div>
      </div>
    </div>
  )
}
