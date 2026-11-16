import { useState, useEffect, useRef } from 'react'
import { C } from '../../constants/colors'
import { pratoColors } from '../../constants/pratos'
import { fmtF, addD, WD, MN } from '../../utils/date'
import { isoWeekNum } from '../../utils/ementaGrid'
import { fmtHorario, refeicaoTerminou } from '../../utils/meal'
import { refeicoesPorDia } from '../../utils/marcar'
import { erroNovoPin, hashPin } from '../../utils/pin'
import { fetchEmentas, fetchDiasFechados, fetchDefinicoes, mobileLogin, mobileAlterarPin, mobileMarcacoes, mobileMarcar, mobileDesmarcar } from '../../lib/queries'
import useHoje from '../../hooks/useHoje'
import Logo from '../../components/Logo'
import Icon from '../../components/Icon'

// Sessão = token opaco das RPCs mobile_*. sessionStorage: fechar o browser pede login outra vez.
const KEY = 'ff_mobile_sessao'
const lerSessao   = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) } catch(_) { return null } }
const gravarSessao = s => { try { s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY) } catch(_) {} }

const DEF_KEYS = ['almoco_inicio','almoco_fim','jantar_inicio','jantar_fim','bloquear_dia_proprio','servir_fds']
const ERROS_LOGIN = {
  errado:     'Número ou PIN incorreto.',
  bloqueado:  'Demasiadas tentativas. Tenta novamente daqui a 15 minutos.',
  sem_acesso: 'Acesso mobile não autorizado. Fala com o responsável da cantina.',
  suspenso:   'Login mobile suspenso por excesso de tentativas. Tenta mais tarde ou usa o quiosque.',
}
const ERROS_MARCAR = {
  bloqueado_hoje: 'As marcações de hoje já não podem ser alteradas.',
  terminou:       'Esta refeição já terminou.',
  fechado:        'A cantina está encerrada neste dia.',
  consumido:      'Esta refeição já foi consumida.',
}

// Tom próprio por refeição (nunca só cor: há sempre ícone e texto). O amarelo da marca fica para HOJE e botões principais.
const MEAL = {
  A: {label:'Almoço', icon:'sun',  tone:'#fb923c', bg:'#2d1a0c'},
  J: {label:'Jantar', icon:'moon', tone:'#818cf8', bg:'#191b3a'},
}
const segunda  = d => addD(d, -((new Date(d+'T12:00:00').getDay() + 6) % 7))
const diaMes   = d => { const x = new Date(d+'T12:00:00'); return `${x.getDate()} ${MN[x.getMonth()]}` }
const fmtCurto = d => `${WD[new Date(d+'T12:00:00').getDay()].toLowerCase()}, ${diaMes(d)}`

const page  = {minHeight:'100dvh',background:C.bg,color:C.text,padding:16,maxWidth:480,margin:'0 auto'}
const label = {fontSize:11,fontWeight:700,color:C.textMuted,display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.08em'}
const input = {width:'100%',height:48,padding:'0 14px',borderRadius:12,border:`1px solid ${C.border}`,background:C.surface3,fontSize:18,marginBottom:14}
const btn   = {width:'100%',height:50,border:'none',borderRadius:99,background:C.yellow,color:C.bg,fontSize:16,fontWeight:800}
const alerta = {padding:'10px 14px',borderRadius:10,background:C.dangerBg,border:`1px solid ${C.danger}44`,color:C.danger,fontSize:14,marginBottom:14}
const pinProps = {type:'password',inputMode:'numeric',pattern:'[0-9]*',maxLength:4,autoComplete:'off'}
const soDigitos = set => e => set(e.target.value.replace(/\D/g,'').slice(0,4))

export default function MobileApp() {
  const [sessao, setSessao] = useState(lerSessao)
  const atualizar = s => { gravarSessao(s); setSessao(s) }
  const sair = () => atualizar(null)
  if (!sessao)              return <Login onOk={atualizar}/>
  if (!sessao.pin_alterado) return <TrocarPin sessao={sessao} onOk={() => atualizar({...sessao, pin_alterado:true})} onSair={sair}/>
  return <Marcacoes sessao={sessao} onSair={sair}/>
}

function Login({onOk}) {
  const [numero, setNumero] = useState('')
  const [pin,    setPin]    = useState('')
  const [erro,   setErro]   = useState('')
  const [busy,   setBusy]   = useState(false)

  const entrar = async e => {
    e.preventDefault()
    setBusy(true); setErro('')
    try {
      const r = await mobileLogin(numero, pin)
      if (r.erro) { setErro(ERROS_LOGIN[r.erro] || ERROS_LOGIN.errado); setPin(''); setBusy(false) }
      else onOk(r)
    } catch(_) { setErro('Sem ligação ao servidor.'); setBusy(false) }
  }

  return (
    <form onSubmit={entrar} style={page}>
      <div style={{margin:'32px 0 40px'}}><Logo/></div>
      <h1 style={{fontSize:28,fontWeight:700,marginBottom:24}}>Entrar</h1>
      {erro && <div role="alert" style={alerta}>{erro}</div>}
      <label style={label} htmlFor="m-num">Nº de funcionário</label>
      <input id="m-num" style={input} inputMode="numeric" autoComplete="username" value={numero} onChange={e => setNumero(e.target.value.replace(/\D/g,'').slice(0,3))} required/>
      <label style={label} htmlFor="m-pin">PIN</label>
      <input id="m-pin" style={input} {...pinProps} value={pin} onChange={soDigitos(setPin)} required/>
      <button style={{...btn,opacity:busy?0.6:1}} disabled={busy || !numero || pin.length!==4}>{busy ? 'A entrar…' : 'Entrar'}</button>
    </form>
  )
}

function TrocarPin({sessao, onOk, onSair}) {
  const [pin,  setPin]  = useState('')
  const [conf, setConf] = useState('')
  const [erro, setErro] = useState('')
  const [busy, setBusy] = useState(false)

  const guardar = async e => {
    e.preventDefault()
    const invalido = erroNovoPin(pin, sessao.numero) || (pin !== conf ? 'Os PINs não coincidem.' : null)
    if (invalido) { setErro(invalido); return }
    setBusy(true); setErro('')
    try { await mobileAlterarPin(sessao.token, await hashPin(pin)); onOk() }
    catch(ex) {
      if (ex?.message === 'sessao_invalida') return onSair()
      setErro('Não foi possível guardar o PIN. Tenta novamente.'); setBusy(false)
    }
  }

  return (
    <form onSubmit={guardar} style={page}>
      <div style={{margin:'32px 0 40px'}}><Logo/></div>
      <h1 style={{fontSize:26,fontWeight:700,marginBottom:8}}>Define o teu PIN</h1>
      <p style={{fontSize:14,color:C.textSub,marginBottom:24,lineHeight:1.5}}>
        Olá, {sessao.nome}. Antes de continuar tens de trocar o PIN inicial. O novo PIN serve também no terminal da cantina.
      </p>
      {erro && <div role="alert" style={alerta}>{erro}</div>}
      <label style={label} htmlFor="m-pin1">Novo PIN (4 dígitos)</label>
      <input id="m-pin1" style={input} {...pinProps} value={pin} onChange={soDigitos(setPin)} required/>
      <label style={label} htmlFor="m-pin2">Confirmar PIN</label>
      <input id="m-pin2" style={input} {...pinProps} value={conf} onChange={soDigitos(setConf)} required/>
      <p style={{fontSize:12,color:C.textMuted,marginBottom:20}}>Sem sequências (1234, 4321), dígitos iguais (0000) nem o teu número de funcionário.</p>
      <button style={{...btn,opacity:busy?0.6:1}} disabled={busy}>{busy ? 'A guardar…' : 'Guardar PIN'}</button>
      <button type="button" onClick={onSair} style={{...btn,background:'transparent',color:C.textSub,marginTop:8}}>Sair</button>
    </form>
  )
}

// Mesmo fluxo do terminal: dia → refeição → prato. Mudar de dia limpa a refeição (obriga a escolher Almoço/Jantar).
function Marcacoes({sessao, onSair}) {
  const today = useHoje()
  const [dados,   setDados]   = useState(null)   // {ementas, fechados, s}
  const [marc,    setMarc]    = useState([])     // [{ementa_id, prato_num}] só do próprio (RPC)
  const [erro,    setErro]    = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [selDay,  setSelDay]  = useState(null)   // null = hoje, ou o 1.º dia com ementa
  const [selMeal, setSelMeal] = useState(null)   // 'A' | 'J' | null
  const [toast,   setToast]   = useState(null)
  const toastTimer = useRef(null)

  const falhou = ex => {
    if (ex?.message === 'sessao_invalida' || ex?.message === 'pin_por_alterar') return onSair()
    setErro(ERROS_MARCAR[ex?.message] || 'Erro ao comunicar com o servidor.')
  }

  useEffect(() => {
    setSelDay(null); setSelMeal(null)
    Promise.all([fetchEmentas(today), fetchDiasFechados(), fetchDefinicoes(DEF_KEYS), mobileMarcacoes(sessao.token)])
      .then(([ementas, fechados, s, m]) => { setDados({ementas, fechados, s}); setMarc(m) })
      .catch(falhou)
  }, [today])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const flash = msg => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2600) }
  const getM  = em => marc.find(x => String(x.ementa_id) === String(em.id))

  const escolher = async (em, p) => {
    const quando = `${MEAL[em.tipo].label} de ${fmtCurto(em.data)}`
    setOcupado(true); setErro('')
    try {
      if (getM(em)?.prato_num === p.n) { await mobileDesmarcar(sessao.token, em.id); flash(`${quando} desmarcado`) }
      else                             { await mobileMarcar(sessao.token, em.id, p.n); flash(`${quando} · ${p.label}`) }
      setMarc(await mobileMarcacoes(sessao.token))
    } catch(ex) { falhou(ex) }
    setOcupado(false)
  }

  if (!dados) return <div style={page}><p style={{color:erro ? C.danger : C.textMuted,marginTop:40}}>{erro || 'A carregar…'}</p></div>

  const s        = dados.s
  const dias     = refeicoesPorDia(dados.ementas, dados.fechados, s.servir_fds, today)
  const dia      = dias.find(d => d.data === selDay) || dias.find(d => d.data === today) || dias[0]
  const semanas  = [...new Set(dias.map(d => segunda(d.data)))]
  const semIdx   = dia ? semanas.indexOf(segunda(dia.data)) : -1
  const daSemana = dia ? dias.filter(d => segunda(d.data) === semanas[semIdx]) : []
  const irDia    = d => { setSelDay(d); setSelMeal(null) }
  const irSemana = i => irDia(dias.find(d => segunda(d.data) === semanas[i]).data)
  const isLocked = e => e.data === today && (s.bloquear_dia_proprio === 'true' || refeicaoTerminou(s, e.tipo, e.data, today))
  const em       = dia?.refeicoes.find(e => e.tipo === selMeal)
  const navBtn   = off => ({width:44,height:44,borderRadius:99,border:`1px solid ${C.border}`,background:'transparent',color:C.textSub,display:'flex',alignItems:'center',justifyContent:'center',opacity:off?0.3:1})

  return (
    <div style={{...page,paddingTop:0,paddingBottom:96}}>
      {/* Topo fixo: quem, semana e dias */}
      <div style={{position:'sticky',top:0,zIndex:10,background:C.bg,padding:'12px 16px',margin:'0 -16px',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:dia ? 10 : 0}}>
          <div style={{fontSize:18,fontWeight:700}}>Olá, {sessao.nome.split(' ')[0]}</div>
          <button onClick={onSair} style={{height:36,background:'none',border:`1px solid ${C.border}`,borderRadius:99,color:C.textSub,fontSize:13,padding:'0 14px',display:'flex',alignItems:'center',gap:6}}>
            <Icon name="logout" size={14}/>Sair
          </button>
        </div>
        {dia && <>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <button aria-label="Semana anterior" disabled={semIdx <= 0} onClick={() => irSemana(semIdx-1)} style={navBtn(semIdx <= 0)}><Icon name="chev-l" size={18}/></button>
            <div style={{fontSize:13,fontWeight:700,color:C.textSub}}>
              Semana {isoWeekNum(semanas[semIdx])} · {diaMes(daSemana[0].data)} – {diaMes(daSemana[daSemana.length-1].data)}
            </div>
            <button aria-label="Semana seguinte" disabled={semIdx >= semanas.length-1} onClick={() => irSemana(semIdx+1)} style={navBtn(semIdx >= semanas.length-1)}><Icon name="chev-r" size={18}/></button>
          </div>
          <div role="tablist" aria-label="Dias" style={{display:'flex',gap:6}}>
            {daSemana.map(d => {
              const dd = new Date(d.data+'T12:00:00'), sel = d.data === dia.data, hoje = d.data === today
              const marcadas = d.refeicoes.filter(getM).map(e => MEAL[e.tipo].label.toLowerCase())
              return (
                <button key={d.data} role="tab" aria-selected={sel} onClick={() => irDia(d.data)}
                  aria-label={`${fmtF(d.data)}${hoje ? ', hoje' : ''}. ${marcadas.length ? 'Marcado: ' + marcadas.join(' e ') : 'Nada marcado'}`}
                  style={{flex:1,minWidth:0,padding:'8px 2px 7px',borderRadius:12,display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                    background:sel ? C.text : C.surface, color:sel ? C.bg : C.text, border:`2px solid ${sel ? C.text : hoje ? C.yellow : C.border}`}}>
                  <span style={{fontSize:10,fontWeight:800,letterSpacing:'0.08em',color:sel ? C.bg : hoje ? C.yellow : C.textMuted}}>{hoje ? 'HOJE' : WD[dd.getDay()].toUpperCase()}</span>
                  <span style={{fontSize:20,fontWeight:700,lineHeight:1}}>{dd.getDate()}</span>
                  <span style={{display:'flex',gap:4}}>
                    {['A','J'].map(t => {
                      const e = d.refeicoes.find(x => x.tipo === t)
                      return <span key={t} style={{width:8,height:8,borderRadius:99,visibility:e ? 'visible' : 'hidden',
                        background:e && getM(e) ? MEAL[t].tone : 'transparent',border:`1.5px solid ${MEAL[t].tone}`}}/>
                    })}
                  </span>
                </button>
              )
            })}
          </div>
        </>}
      </div>

      {erro && <div role="alert" style={{...alerta,marginTop:14}}>{erro}</div>}

      {!dia ? <p style={{color:C.textMuted,marginTop:24}}>Ainda não há ementas publicadas.</p> : <>
        <h1 style={{fontSize:22,fontWeight:700,margin:'18px 0 12px'}}>
          {dia.data === today && <span style={{color:C.yellow}}>Hoje · </span>}{fmtF(dia.data)}
        </h1>

        {/* Refeições do dia */}
        <div role="tablist" aria-label="Refeição" style={{display:'grid',gridTemplateColumns:`repeat(${dia.refeicoes.length}, minmax(0,1fr))`,gap:8,marginBottom:16}}>
          {dia.refeicoes.map(e => {
            const m = MEAL[e.tipo], sel = selMeal === e.tipo, mc = getM(e), locked = isLocked(e)
            return (
              <button key={e.id} role="tab" aria-selected={sel} onClick={() => setSelMeal(e.tipo)}
                style={{textAlign:'left',padding:'12px 12px 10px',borderRadius:14,background:sel ? m.bg : C.surface,border:`2px solid ${sel ? m.tone : C.border}`,color:C.text}}>
                <div style={{display:'flex',alignItems:'center',gap:8,color:m.tone}}>
                  <Icon name={m.icon} size={20}/>
                  <span style={{fontSize:16,fontWeight:800,letterSpacing:'0.04em',textTransform:'uppercase'}}>{m.label}</span>
                </div>
                <div style={{fontSize:12,color:C.textMuted,margin:'4px 0 6px'}}>{fmtHorario(s, e.tipo)}</div>
                <div style={{display:'flex',alignItems:'center',gap:5,fontSize:12,fontWeight:700,color:mc ? C.success : C.textSub}}>
                  {locked ? <Icon name="lock" size={12}/> : mc && <Icon name="check" size={12}/>}
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{mc ? e[`prato${mc.prato_num}_label`] : locked ? 'Fechado' : 'Por marcar'}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Pratos */}
        {!em ? (
          <div style={{border:`2px dashed ${C.border2}`,borderRadius:14,padding:'28px 16px',textAlign:'center',color:C.textSub,fontSize:15,lineHeight:1.5}}>
            Escolhe <strong style={{color:MEAL.A.tone}}>Almoço</strong>{dia.refeicoes.length > 1 && <> ou <strong style={{color:MEAL.J.tone}}>Jantar</strong></>} para ver os pratos.
          </div>
        ) : <Pratos em={em} mc={getM(em)} locked={isLocked(em)} ocupado={ocupado} onEscolher={p => escolher(em, p)}/>}
      </>}

      <div aria-live="polite" style={{position:'fixed',left:16,right:16,bottom:'calc(16px + env(safe-area-inset-bottom))',display:'flex',justifyContent:'center',pointerEvents:'none',zIndex:20}}>
        {toast && <div style={{background:C.text,color:C.bg,borderRadius:14,padding:'12px 18px',fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:8,boxShadow:'0 12px 32px rgba(0,0,0,.45)'}}>
          <Icon name="check" size={18}/>{toast}
        </div>}
      </div>
    </div>
  )
}

function Pratos({em, mc, locked, ocupado, onEscolher}) {
  const m = MEAL[em.tipo]
  const pratos = [1,2,3,4].map(n => ({n, label:em[`prato${n}_label`], desc:em[`prato${n}_desc`]})).filter(p => p.label)
  return <>
    <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:700,color:m.tone,marginBottom:10}}>
      <Icon name={m.icon} size={16}/>Pratos do {m.label.toLowerCase()}
      {locked && <span style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:4,color:C.textMuted}}><Icon name="lock" size={13}/>Só leitura</span>}
    </div>
    <div style={{display:'grid',gap:8}}>
      {pratos.map(p => {
        const sel = mc?.prato_num === p.n, pc = pratoColors(p.n)
        return (
          <button key={p.n} aria-pressed={sel} disabled={locked || ocupado} onClick={() => onEscolher(p)}
            style={{display:'flex',alignItems:'stretch',height:80,padding:0,borderRadius:12,overflow:'hidden',textAlign:'left',color:C.text,
              background:sel ? m.bg : C.surface,border:`2px solid ${sel ? m.tone : C.border}`,opacity:locked && !sel ? 0.5 : 1,cursor:locked ? 'default' : 'pointer'}}>
            <span style={{width:6,flexShrink:0,background:pc.fg}}/>
            <span style={{flex:1,padding:'10px 12px',display:'flex',flexDirection:'column',justifyContent:'center',gap:2}}>
              <span style={{fontSize:11,fontWeight:800,letterSpacing:'0.08em',textTransform:'uppercase',color:pc.fg}}>{p.label}</span>
              {/* Altura fixa para 2 linhas; acima disso corta com reticências */}
              <span style={{fontSize:16,lineHeight:1.3,color:sel ? C.text : C.textSub,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{p.desc || '—'}</span>
            </span>
            {sel && <span style={{display:'flex',alignItems:'center',padding:'0 14px',color:m.tone}}><Icon name={locked ? 'lock' : 'check'} size={22}/></span>}
          </button>
        )
      })}
    </div>
    {mc && !locked && <p style={{fontSize:13,color:C.textMuted,marginTop:10}}>Toca no prato escolhido para desmarcar.</p>}
  </>
}
