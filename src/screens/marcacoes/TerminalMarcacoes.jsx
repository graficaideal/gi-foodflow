import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { C } from '../../constants/colors'
import { DEFAULTS } from '../../constants/settings'
import { WD, WD_FULL, MN, TODAY, addD } from '../../utils/date'
import { fmtHorario } from '../../utils/meal'
import { diasMarcaveis } from '../../utils/marcar'
import { fetchDiasFechados } from '../../lib/queries'
import Avatar from '../../components/Avatar'
import Icon from '../../components/Icon'
import Logo from '../../components/Logo'
import LoginShell, { ARR } from '../../components/LoginShell'
import PratoCard from '../../components/PratoCard'
import { pratoColors } from '../../constants/pratos'
import useSerial from '../../hooks/useSerial'

const MEALS = [{tipo:'A',emoji:'🌞',label:'Almoço'},{tipo:'J',emoji:'🌙',label:'Jantar'}]

// Segunda-feira da semana 0. Ao fim de semana, a semana 0 é a seguinte.
const WEEK0 = (() => { const wd = new Date(TODAY+'T12:00:00').getDay(); return addD(TODAY, wd===0 ? 1 : wd===6 ? 2 : 1-wd) })()

// Abaixo de 1200px (POS 1024×768): layout compacto
const NARROW = '(max-width:1199px)'
const useNarrow = () => {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches)
  useEffect(() => {
    const m = window.matchMedia(NARROW), h = e => setNarrow(e.matches)
    m.addEventListener('change', h); return () => m.removeEventListener('change', h)
  }, [])
  return narrow
}

function MealPill({letter, done, locked, on}) {
  const bg = done ? (on ? C.bg : C.success) : 'transparent'
  const bd = done ? bg : on ? C.bg+'66' : C.border2
  return (
    <span style={{flex:1,minWidth:0,height:30,borderRadius:8,background:bg,border:`2px solid ${bd}`,color:done?(on?C.yellow:C.bg):(on?C.bg:C.textMuted),display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4,fontSize:13,fontWeight:800}}>
      {letter}{done && <Icon name={locked?'lock':'check'} size={13}/>}
    </span>
  )
}

// Canto côncavo (R=14) na base da aba selecionada, assente na borda superior do painel.
const FILLET = 14
function Fillet({side}) {
  return <span style={{position:'absolute',bottom:3,[side]:-(3+FILLET),width:FILLET,height:FILLET,pointerEvents:'none',
    background:`radial-gradient(circle at ${side==='left'?'0 0':'100% 0'}, transparent ${FILLET}px, ${C.yellow} ${FILLET+0.5}px)`}}/>
}

// Aba do dia: a selecionada desce até ao fundo da linha superior do painel e funde-se com ela.
function DayChip({d, sel, isToday, past, marks, locked, onClick}) {
  const dd = new Date(d+'T12:00:00')
  return (
    <button onClick={onClick}
      style={{flex:1,minWidth:0,cursor:'pointer',fontFamily:'inherit',textAlign:'left',height:sel?112:100,background:sel?C.yellow:C.surface,color:sel?C.bg:C.text,border:`${sel?3:2}px solid ${sel?C.yellow:C.border2}`,borderBottomWidth:sel?0:2,borderRadius:sel?'16px 16px 0 0':16,padding:sel?'10px 12px 19px':'10px 12px',display:'flex',flexDirection:'column',justifyContent:'space-between',overflow:sel?'visible':'hidden',position:sel?'relative':undefined,opacity:past&&!sel?0.5:1}}>
      {sel && <><Fillet side="left"/><Fillet side="right"/></>}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>
        <div style={{display:'flex',alignItems:'baseline',gap:6,minWidth:0}}>
          <span style={{fontSize:34,fontWeight:700,lineHeight:1}}>{String(dd.getDate()).padStart(2,'0')}</span>
          <span style={{fontSize:14,fontWeight:800,letterSpacing:'0.08em',opacity:sel?0.75:0.6}}>{WD[dd.getDay()].toUpperCase()}</span>
        </div>
        {isToday && <span style={{fontSize:10,fontWeight:800,letterSpacing:'0.1em',padding:'3px 6px',borderRadius:6,background:sel?C.bg:C.yellow,color:sel?C.yellow:C.bg,flexShrink:0}}>HOJE</span>}
      </div>
      <div style={{display:'flex',gap:6}}>
        {MEALS.map(m => <MealPill key={m.tipo} letter={m.tipo} done={marks[m.tipo]} locked={locked} on={sel}/>)}
      </div>
    </button>
  )
}

// Botão de refeição: obrigatório antes dos pratos. Selecionado = mustard + seta para os pratos.
function MealButton({emoji, label, hour, on, pratoLabel, locked, past, onClick}) {
  const st = pratoLabel ? {icon:locked?'lock':'check', text:pratoLabel, color:on?C.bg:C.success}
    : locked ? {icon:'lock', text:past?'Dia já passou':'Fechado', color:on?C.bg:C.textSub}
    : {icon:null, text:'Por marcar', color:on?C.bg:C.warn}
  return (
    <button onClick={onClick}
      style={{flex:1,minHeight:0,position:'relative',cursor:'pointer',fontFamily:'inherit',textAlign:'left',background:on?C.yellow:C.surface,color:on?C.bg:C.text,border:`3px solid ${on?C.yellow:C.border2}`,borderRadius:16,padding:'16px 18px',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <span style={{fontSize:30,lineHeight:1}}>{emoji}</span>
        <div>
          <div style={{fontSize:30,fontWeight:800,lineHeight:1}}>{label}</div>
          <div style={{fontSize:14,fontWeight:600,marginTop:5,opacity:0.75}}>{hour}</div>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,fontSize:16,fontWeight:800,color:st.color,minWidth:0}}>
        {st.icon ? <Icon name={st.icon} size={18}/> : <span style={{width:12,height:12,borderRadius:'50%',border:`2.5px solid ${st.color}`,flexShrink:0}}/>}
        <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{st.text}</span>
      </div>
      {on && <span style={{position:'absolute',right:-19,top:'50%',transform:'translateY(-50%)',width:0,height:0,borderTop:'14px solid transparent',borderBottom:'14px solid transparent',borderLeft:`14px solid ${C.yellow}`}}/>}
    </button>
  )
}

// "quinta, 04 Jun"
const fmtDia = d => { const x=new Date(d+'T12:00:00'); return `${WD_FULL[x.getDay()].split('-')[0].toLowerCase()}, ${String(x.getDate()).padStart(2,'0')} ${MN[x.getMonth()]}` }

// Painel lateral: marcações de hoje em diante, agrupadas por dia. Eliminar = 2 toques; linha bloqueada sem ação.
function MinhasMarcacoes({items, total, narrow, s, isLocked, confirmId, setConfirmId, onRemove, onOpen, onClose}) {
  const groups = []
  items.forEach(it => { const g=groups[groups.length-1]; g?.data===it.em.data ? g.items.push(it) : groups.push({data:it.em.data,items:[it]}) })
  return (
    <div style={{position:'absolute',inset:0,zIndex:10,display:'flex',justifyContent:'flex-end'}}>
      <div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}/>
      <div style={{position:'relative',width:narrow?520:600,height:'100%',background:C.surface,borderLeft:`1px solid ${C.border}`,boxShadow:'0 24px 64px rgba(0,0,0,0.5)',display:'flex',flexDirection:'column',borderRadius:'20px 0 0 20px',overflow:'hidden',animation:'ff-sheet-in .2s ease-out'}}>
        <div style={{height:88,flexShrink:0,padding:'0 16px 0 24px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:`1px solid ${C.border}`}}>
          <div>
            <div style={{fontSize:26,fontWeight:800,lineHeight:1.1}}>As minhas marcações</div>
            <div style={{fontSize:15,color:C.textSub,marginTop:4}}>{total} {total===1?'refeição marcada':'refeições marcadas'} · de hoje em diante</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{width:60,height:60,borderRadius:14,background:C.bg,border:`2px solid ${C.border2}`,color:C.text,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon name="x" size={26}/>
          </button>
        </div>
        <div style={{flex:1,minHeight:0,overflowY:'auto',padding:'8px 16px 20px'}}>
          {groups.length===0 && (
            <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,color:C.textSub,textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:700,color:C.text}}>Sem marcações.</div>
              <div style={{fontSize:16}}>Escolhe um dia e marca a primeira refeição.</div>
            </div>
          )}
          {groups.map(g => (
            <div key={g.data} style={{marginTop:14}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'0 6px 8px'}}>
                <span style={{fontSize:15,fontWeight:800,letterSpacing:'0.08em',textTransform:'uppercase',color:C.textSub}}>{fmtDia(g.data)}</span>
                {g.data===TODAY && <span style={{fontSize:10,fontWeight:800,letterSpacing:'0.1em',padding:'3px 6px',borderRadius:6,background:C.yellow,color:C.bg}}>HOJE</span>}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {g.items.map(({em,meal,n}) => {
                  const {fg} = pratoColors(n)
                  const locked = isLocked(em.data)
                  const conf = confirmId===em.id
                  return (
                    <div key={em.id} style={{display:'flex',alignItems:'stretch',gap:8,height:80}}>
                      <button onClick={locked?undefined:()=>onOpen(em)} style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:14,padding:'0 16px 0 0',background:conf?'rgba(248,113,113,0.08)':C.bg,border:`2px solid ${conf?C.danger:C.border2}`,borderRadius:14,cursor:locked?'default':'pointer',fontFamily:'inherit',textAlign:'left',color:C.text,overflow:'hidden'}}>
                        <span style={{width:8,alignSelf:'stretch',background:fg,flexShrink:0}}/>
                        <div style={{width:96,flexShrink:0}}>
                          <div style={{fontSize:13,color:C.textSub,fontWeight:600}}>{meal.emoji} {fmtHorario(s,meal.tipo).split(' ')[0]}</div>
                          <div style={{fontSize:19,fontWeight:800,marginTop:2}}>{meal.label}</div>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:800,letterSpacing:'0.06em',textTransform:'uppercase',color:fg,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{em[`prato${n}_label`]}</div>
                          <div style={{fontSize:16,fontWeight:500,marginTop:3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{em[`prato${n}_desc`]}</div>
                        </div>
                      </button>
                      {locked ? (
                        <div style={{width:80,flexShrink:0,borderRadius:14,border:`2px solid ${C.border2}`,color:C.textMuted,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,fontSize:12,fontWeight:700}}>
                          <Icon name="lock" size={20}/>Fechado
                        </div>
                      ) : conf ? (
                        <div style={{display:'flex',gap:8,flexShrink:0}}>
                          <button onClick={()=>setConfirmId(null)} aria-label="Cancelar" style={{width:64,borderRadius:14,background:C.bg,border:`2px solid ${C.border2}`,color:C.text,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon name="x" size={22}/></button>
                          <button onClick={()=>onRemove(em,meal.label)} style={{width:120,borderRadius:14,background:C.danger,border:`2px solid ${C.danger}`,color:'#fff',fontSize:17,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',gap:8,cursor:'pointer',fontFamily:'inherit'}}><Icon name="trash" size={20}/>Eliminar</button>
                        </div>
                      ) : (
                        <button onClick={()=>setConfirmId(em.id)} aria-label="Eliminar" style={{width:80,flexShrink:0,borderRadius:14,background:'transparent',border:'2px solid rgba(248,113,113,0.45)',color:C.danger,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                          <Icon name="trash" size={24}/>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TerminalMarcacoes({funcionarios,ementas:todasEmentas,settings,reload,onBack}) {
  const s = {...DEFAULTS,...settings}
  const isKiosk = new URLSearchParams(window.location.search).get('kiosk') === '1'
  const [step,      setStep]      = useState('numero')
  const [numInput,  setNumInput]  = useState('')
  const [pinInput,  setPinInput]  = useState('')
  const [func,      setFunc]      = useState(null)
  const [err,       setErr]       = useState('')
  const [selDay,    setSelDay]    = useState(TODAY)
  const [weekOffset,setWeekOffset]= useState(0)
  const [selMeal,   setSelMeal]   = useState(null)   // 'A' | 'J' | null
  const [marcacoes, setMarcacoes] = useState([])
  const [rfidMsg,   setRfidMsg]   = useState('')
  const [toast,     setToast]     = useState(null)   // { msg, error }
  const [listOpen,  setListOpen]  = useState(false)
  const [confirmId, setConfirmId] = useState(null)   // ementa_id em confirmação de eliminação
  const [fechados,  setFechados]  = useState([])     // datas em cantina_dias_fechados
  const [refreshing,setRefreshing]= useState(false)
  const toastTimer = useRef(null)
  const narrow = useNarrow()
  // Dias encerrados não existem para o terminal: sem ementa, sem marcação.
  const ementas = todasEmentas.filter(e => !fechados.includes(e.data))

  // RFID via ref — usado pelo useSerial para evitar stale closure
  const onUidRef = useRef(uid => {
    const f = funcionarios.find(f => f.rfid === uid)
    if (!f || !f.ativo) { setRfidMsg(`Cartão lido: ${uid} — não encontrado.`); setTimeout(()=>setRfidMsg(''),5000); return }
    setRfidMsg(''); loginFunc(f, true)
  })
  // Atualiza o ref quando funcionarios muda
  useEffect(() => {
    onUidRef.current = uid => {
      const f = funcionarios.find(f => f.rfid === uid)
      if (!f || !f.ativo) { setRfidMsg(`Cartão lido: ${uid} — não encontrado.`); setTimeout(()=>setRfidMsg(''),5000); return }
      setRfidMsg(''); loginFunc(f, true)
    }
  }, [funcionarios])

  const {serialStatus} = useSerial(onUidRef)

  // HID fallback
  const rfidRef = useRef(''); const rfidTimer = useRef(null)
  useEffect(() => {
    if (step==='dashboard') return
    const h = e => {
      if(e.key==='Enter'){if(rfidRef.current){onUidRef.current(rfidRef.current.replace(/[^\x21-\x7E]/g,'').trim());rfidRef.current=''}return}
      if(e.key.length!==1) return
      rfidRef.current+=e.key; clearTimeout(rfidTimer.current)
      rfidTimer.current=setTimeout(()=>{rfidRef.current=''},200)
    }
    window.addEventListener('keydown',h)
    return()=>{window.removeEventListener('keydown',h);clearTimeout(rfidTimer.current)}
  },[step])

  const loadMarcacoes = async fid => { const{data}=await supabase.from('cantina_marcacoes').select('*').eq('funcionario_id',fid); setMarcacoes(data||[]) }

  const loadFechados = () => fetchDiasFechados().then(setFechados)

  const loginFunc = (f, viaRfid = false) => {
    loadMarcacoes(f.id); loadFechados()
    if(f.pin && !viaRfid){setFunc(f);setStep('pin');setNumInput('');setErr('')}
    else{setFunc(f);setStep('dashboard');setNumInput('');setErr('')}
  }

  const submitNumero = () => {
    const v=numInput.trim()
    const f=funcionarios.find(f=>f.numero===v||f.numero===v.padStart(3,'0'))
    if(!f||!f.ativo){setErr('Código não encontrado');setNumInput('');setTimeout(()=>setErr(''),3000);return}
    loginFunc(f)
  }

  const submitPin = () => {
    if(pinInput===func.pin){setStep('dashboard');setPinInput('');setErr('')}
    else{setErr('PIN incorreto');setPinInput('');setTimeout(()=>setErr(''),3000)}
  }

  const logout = () => {setStep('numero');setFunc(null);setNumInput('');setPinInput('');setErr('');setSelDay(TODAY);setSelMeal(null);setWeekOffset(0);setMarcacoes([]);setListOpen(false);setConfirmId(null)}

  if (step==='numero') {
    const leftPanel = (
      <div>
        <div style={{fontSize:14,fontWeight:700,color:ARR.ink3,letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:16}}>Bom dia 👋</div>
        <div style={{fontSize:132,lineHeight:0.9,color:ARR.ink,letterSpacing:'-0.01em',marginBottom:4}}>Olá.</div>
        <div style={{fontStyle:'italic',fontSize:56,lineHeight:1.05,color:ARR.ink2}}>Quem é que vai comer?</div>
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
        {rfidMsg && <div style={{marginTop:12,padding:'8px 12px',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:8,fontSize:12,color:'#fbbf24'}}>{rfidMsg}</div>}
      </div>
    )
    return <LoginShell leftPanel={leftPanel} value={numInput} onChange={setNumInput} onConfirm={submitNumero} onBack={isKiosk?undefined:onBack} serialStatus={serialStatus} error={err} />
  }

  if (step==='pin') {
    const leftPanel = (
      <div>
        <div style={{display:'flex',alignItems:'center',gap:18,marginBottom:28}}>
          <Avatar nome={func.nome} foto={func.foto} size={72}/>
          <div>
            <div style={{fontSize:42,lineHeight:1,fontWeight:800,color:ARR.ink}}>{func.nome}</div>
            <div style={{fontSize:14,color:ARR.ink3,marginTop:4}}>Nº {func.numero}</div>
          </div>
        </div>
        <div style={{fontStyle:'italic',fontSize:56,lineHeight:1.05,color:ARR.ink2}}>Introduz o teu PIN.</div>
      </div>
    )
    const backPin = () => { setStep('numero'); setFunc(null); setPinInput(''); setErr('') }
    return <LoginShell leftPanel={leftPanel} value={pinInput} secret onChange={setPinInput} onConfirm={submitPin} onBack={backPin} serialStatus={serialStatus} error={err} />
  }

  const bloqueado = s.bloquear_dia_proprio==='true'

  // Semana de trabalho (seg–sex) sem os dias encerrados. Se selDay não pertence à semana visível, seleciona o 1.º dia não passado.
  const daysOf   = off => diasMarcaveis(TODAY, off, fechados)
  const weekDays = daysOf(weekOffset)
  const day      = weekDays.includes(selDay) ? selDay : (weekDays.find(d=>d>=TODAY) || weekDays[0])   // undefined se a semana está toda encerrada
  const hasPrev  = weekOffset > 0
  const hasNext  = ementas.some(e=>e.data>addD(WEEK0, weekOffset*7+4))
  // Mudar de dia ou de semana limpa SEMPRE a refeição: obriga a confirmar a refeição em cada dia.
  const selectDay = d => { setSelDay(d); setSelMeal(null) }
  const goWeek   = off => { const w=daysOf(off); setWeekOffset(off); selectDay(w.find(d=>d>=TODAY) || w[0]) }
  const isLocked = d => d<TODAY || (d===TODAY && bloqueado)

  const dayEm  = ementas.filter(e=>e.data===day)
  const getM   = eid => marcacoes.find(m=>m.funcionario_id===func.id&&m.ementa_id===eid)
  const marcar = async (em,n) => { const{error}=await supabase.from('cantina_marcacoes').upsert({funcionario_id:func.id,ementa_id:em.id,prato_num:n},{onConflict:'funcionario_id,ementa_id'}); await loadMarcacoes(func.id); return error }
  const cancelar = async eid => { const{error}=await supabase.from('cantina_marcacoes').delete().eq('funcionario_id',func.id).eq('ementa_id',eid); await loadMarcacoes(func.id); return error }

  const flash = (msg, error=false) => {
    setToast({msg,error}); clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(()=>setToast(null), 2600)
  }
  const dia = day ? fmtDia(day) : ''
  const refresh = async () => {
    setRefreshing(true)
    await Promise.all([reload(), loadMarcacoes(func.id), loadFechados()]).catch(()=>{})
    setRefreshing(false)
  }
  const doMarcar   = async (em,n,label,pratoLabel) => { if (await marcar(em,n)) flash('Erro ao guardar',true); else flash(`${label} de ${dia} · ${pratoLabel}`) }
  const doCancelar = async (em,label,verbo='desmarcado') => { if (await cancelar(em.id)) flash('Erro ao guardar',true); else flash(`${label} de ${fmtDia(em.data)} ${verbo}`) }

  const futureIds = new Set(ementas.filter(e=>e.data>=TODAY).map(e=>e.id))
  const nFuturas  = marcacoes.filter(m=>futureIds.has(m.ementa_id)).length
  const minhas    = ementas.filter(e=>futureIds.has(e.id)).map(em=>({em,meal:MEALS.find(m=>m.tipo===em.tipo),n:getM(em.id)?.prato_num})).filter(x=>x.n&&x.meal)
    .sort((a,b)=>a.em.data.localeCompare(b.em.data)||a.em.tipo.localeCompare(b.em.tipo))
  const closeList = () => { setListOpen(false); setConfirmId(null) }
  const openFromList = em => {
    const off = Math.floor(Math.round((new Date(em.data+'T12:00:00')-new Date(WEEK0+'T12:00:00'))/864e5)/7)
    setWeekOffset(off); setSelDay(em.data); setSelMeal(em.tipo); closeList()
  }
  const removeFromList = async (em,label) => { setConfirmId(null); await doCancelar(em,label,'eliminado') }
  const locked    = isLocked(day)
  const arrow = off => ({width:60,height:100,flexShrink:0,background:C.surface,border:`2px solid ${C.border2}`,borderRadius:16,color:C.textSub,display:'flex',alignItems:'center',justifyContent:'center',cursor:off?'default':'pointer',opacity:off?0.3:1})

  // Refeição escolhida neste dia (só existe se o dia tiver ementa desse tipo)
  const em     = selMeal && dayEm.find(e=>e.tipo===selMeal)
  const meal   = em && MEALS.find(m=>m.tipo===selMeal)
  const marc   = em && getM(em.id)
  const pratos = em ? [1,2,3,4].map(n=>({n,label:em[`prato${n}_label`],desc:em[`prato${n}_desc`]})).filter(p=>p.label) : []

  return (
    <div style={{height:'100vh',background:C.bg,color:C.text,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
      {/* Topbar */}
      <div style={{height:80,padding:'0 20px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,gap:16}}>
        <div style={{display:'flex',alignItems:'center',gap:18,minWidth:0}}>
          {!narrow && <Logo size="sm" showSub={false}/>}
          {!narrow && <div style={{width:1,height:40,background:C.border}}/>}
          <Avatar nome={func.nome} foto={func.foto} size={52}/>
          <div style={{minWidth:0}}>
            <div style={{fontSize:24,fontWeight:700,lineHeight:1.1}}>Olá, {func.nome.split(' ')[0]}</div>
            <div style={{fontSize:14,color:C.textSub,marginTop:3}}>Nº {func.numero} · {nFuturas} {nFuturas===1?'refeição marcada':'refeições marcadas'}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:10,flexShrink:0}}>
          <button onClick={refresh} disabled={refreshing} aria-label="Atualizar" style={{width:60,height:60,flexShrink:0,background:C.surface,border:`2px solid ${C.border2}`,borderRadius:14,color:C.text,display:'flex',alignItems:'center',justifyContent:'center',cursor:refreshing?'default':'pointer'}}>
            <span style={{display:'flex',animation:refreshing?'spin 0.8s linear infinite':undefined}}><Icon name="refresh" size={24}/></span>
          </button>
          <button onClick={()=>{setListOpen(true);setConfirmId(null)}} style={{height:60,padding:'0 22px',background:C.surface,border:`2px solid ${C.border2}`,borderRadius:14,color:C.text,fontSize:18,fontWeight:700,display:'inline-flex',alignItems:'center',gap:12,cursor:'pointer',fontFamily:'inherit'}}>
            <Icon name="list" size={22}/>{narrow?'Marcações':'As minhas marcações'}
            <span style={{minWidth:32,height:32,padding:'0 9px',borderRadius:99,background:C.yellow,color:C.bg,fontSize:16,fontWeight:800,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{nFuturas}</span>
          </button>
          <button onClick={logout} style={{height:60,padding:'0 26px',flexShrink:0,background:C.surface,border:`2px solid ${C.border2}`,borderRadius:14,color:C.text,fontSize:18,fontWeight:700,display:'inline-flex',alignItems:'center',gap:12,cursor:'pointer',fontFamily:'inherit'}}>
            <Icon name="logout" size={22}/>Terminar
          </button>
        </div>
      </div>

      {/* Week strip: o dia selecionado é uma aba ligada ao painel */}
      <div style={{height:112,padding:'0 20px',display:'flex',gap:8,flexShrink:0,alignItems:'flex-start',position:'relative',zIndex:2}}>
        <button disabled={!hasPrev} onClick={()=>goWeek(weekOffset-1)} aria-label="Semana anterior" style={arrow(!hasPrev)}><Icon name="chev-l" size={30}/></button>
        {weekDays.map(d => {
          const marks = Object.fromEntries(MEALS.map(m => { const e=ementas.find(e=>e.data===d&&e.tipo===m.tipo); return [m.tipo, !!(e&&getM(e.id))] }))
          return <DayChip key={d} d={d} sel={day===d} isToday={d===TODAY} past={d<TODAY} marks={marks} locked={isLocked(d)} onClick={()=>selectDay(d)}/>
        })}
        <button disabled={!hasNext} onClick={()=>goWeek(weekOffset+1)} aria-label="Semana seguinte" style={arrow(!hasNext)}><Icon name="chev-r" size={30}/></button>
      </div>

      {/* Painel do dia */}
      <div style={{flex:1,minHeight:0,margin:'-3px 20px 20px',border:`3px solid ${C.yellow}`,borderRadius:20,background:C.surface,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative',zIndex:1}}>
        <div style={{height:64,flexShrink:0,padding:'0 20px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:`1px solid ${C.border}`,gap:16}}>
          <div style={{display:'flex',alignItems:'baseline',gap:12,minWidth:0}}>
            <span style={{fontSize:12,fontWeight:800,letterSpacing:'0.12em',color:C.textMuted,flexShrink:0}}>{meal ? 'A MARCAR' : 'PASSO 1 DE 2'}</span>
            <span style={{fontSize:narrow?22:26,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {meal ? <><span style={{color:C.yellow}}>{meal.label}</span> de {dia}</> : <>Escolhe almoço ou jantar de <span style={{color:C.yellow}}>{dia}</span></>}
            </span>
          </div>
          {marc && !locked && (
            <button onClick={()=>doCancelar(em,meal.label)} style={{height:48,padding:'0 18px',flexShrink:0,borderRadius:12,background:'transparent',border:`2px solid ${C.border2}`,color:C.text,fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:8}}>
              <Icon name="x" size={18}/>Desmarcar
            </button>
          )}
        </div>

        {dayEm.length===0 ? (
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:C.textSub,fontSize:20}}>{day ? 'Sem ementa para este dia.' : 'Cantina encerrada esta semana.'}</div>
        ) : (
          <div style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:`${narrow?250:300}px minmax(0,1fr)`}}>
            <div style={{padding:16,display:'flex',flexDirection:'column',gap:12,borderRight:`1px solid ${C.border}`,background:C.bg}}>
              {MEALS.map(({tipo,emoji,label}) => {
                const e=dayEm.find(e=>e.tipo===tipo); if(!e) return null
                const m=getM(e.id)
                return <MealButton key={tipo} emoji={emoji} label={label} hour={fmtHorario(s,tipo)} on={selMeal===tipo}
                  pratoLabel={m && e[`prato${m.prato_num}_label`]} locked={locked} past={day<TODAY} onClick={()=>setSelMeal(tipo)}/>
              })}
            </div>
            <div style={{padding:16,minHeight:0,display:'flex'}}>
              {!meal ? (
                <div style={{flex:1,borderRadius:16,border:`2px dashed ${C.border2}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,color:C.textSub,textAlign:'center',padding:24}}>
                  <div style={{width:72,height:72,borderRadius:'50%',background:C.bg,border:`2px solid ${C.border2}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Icon name="arrow-l" size={34} color={C.yellow}/>
                  </div>
                  <div style={{fontSize:26,fontWeight:700,color:C.text}}>Primeiro, escolhe a refeição</div>
                  <div style={{fontSize:17,maxWidth:420,lineHeight:1.4}}>Toca em <strong style={{color:C.text}}>Almoço</strong> ou <strong style={{color:C.text}}>Jantar</strong> à esquerda para ver os pratos de {dia}.</div>
                </div>
              ) : (
                <div style={{flex:1,display:'grid',gridTemplateColumns:'repeat(2, minmax(0,1fr))',gridTemplateRows:'repeat(2, minmax(0,1fr))',gap:12}}>
                  {pratos.map(p => (
                    <PratoCard key={p.n} slot={p.n} label={p.label} desc={p.desc} locked={locked} compact={narrow}
                      selected={marc?.prato_num===p.n} dim={marc ? marc.prato_num!==p.n : locked}
                      onClick={()=>marc?.prato_num===p.n ? doCancelar(em,meal.label) : doMarcar(em,p.n,meal.label,p.label)}/>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {listOpen && <MinhasMarcacoes items={minhas} total={nFuturas} narrow={narrow} s={s} isLocked={isLocked}
        confirmId={confirmId} setConfirmId={setConfirmId} onRemove={removeFromList} onOpen={openFromList} onClose={closeList}/>}

      {toast && (
        <div role="status" style={{position:'absolute',left:'50%',bottom:34,transform:'translateX(-50%)',background:C.text,color:toast.error?C.danger:C.bg,borderRadius:14,padding:'16px 26px',fontSize:18,fontWeight:700,display:'flex',alignItems:'center',gap:12,boxShadow:'0 16px 40px rgba(0,0,0,0.45)',whiteSpace:'nowrap',zIndex:20}}>
          <Icon name={toast.error?'warn':'check'} size={22}/>{toast.msg}
        </div>
      )}
    </div>
  )
}
