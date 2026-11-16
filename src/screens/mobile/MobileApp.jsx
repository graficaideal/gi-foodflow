import { useState, useEffect } from 'react'
import { C } from '../../constants/colors'
import { fmtF } from '../../utils/date'
import { fmtHorario, refeicaoTerminou } from '../../utils/meal'
import { refeicoesPorDia } from '../../utils/marcar'
import { erroNovoPin, hashPin } from '../../utils/pin'
import { fetchEmentas, fetchDiasFechados, fetchDefinicoes, mobileLogin, mobileAlterarPin, mobileMarcacoes, mobileMarcar, mobileDesmarcar } from '../../lib/queries'
import useHoje from '../../hooks/useHoje'
import Logo from '../../components/Logo'
import PratoBtn from '../../components/PratoBtn'

// Sessão = token opaco das RPCs mobile_*. sessionStorage: fechar o browser pede login outra vez.
const KEY = 'ff_mobile_sessao'
const lerSessao   = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) } catch(_) { return null } }
const gravarSessao = s => { try { s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY) } catch(_) {} }

const DEF_KEYS = ['almoco_inicio','almoco_fim','jantar_inicio','jantar_fim','bloquear_dia_proprio','servir_fds']
const ERROS_LOGIN = {
  errado:     'Número ou PIN incorreto.',
  bloqueado:  'Demasiadas tentativas. Tenta novamente daqui a 15 minutos.',
  sem_acesso: 'Acesso mobile não autorizado. Fala com o responsável da cantina.',
}
const ERROS_MARCAR = {
  bloqueado_hoje: 'As marcações de hoje já não podem ser alteradas.',
  terminou:       'Esta refeição já terminou.',
  fechado:        'A cantina está encerrada neste dia.',
  consumido:      'Esta refeição já foi consumida.',
}

const page  = {minHeight:'100vh',background:C.bg,color:C.text,padding:16,maxWidth:480,margin:'0 auto'}
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

function Marcacoes({sessao, onSair}) {
  const today = useHoje()
  const [dados,   setDados]   = useState(null)   // {ementas, fechados, s}
  const [marc,    setMarc]    = useState([])     // [{ementa_id, prato_num}] só do próprio (RPC)
  const [erro,    setErro]    = useState('')
  const [ocupado, setOcupado] = useState(null)   // ementa_id a gravar

  const falhou = ex => {
    if (ex?.message === 'sessao_invalida' || ex?.message === 'pin_por_alterar') return onSair()
    setErro(ERROS_MARCAR[ex?.message] || 'Erro ao comunicar com o servidor.')
  }

  useEffect(() => {
    Promise.all([fetchEmentas(today), fetchDiasFechados(), fetchDefinicoes(DEF_KEYS), mobileMarcacoes(sessao.token)])
      .then(([ementas, fechados, s, m]) => { setDados({ementas, fechados, s}); setMarc(m) })
      .catch(falhou)
  }, [today])

  const escolher = async (em, n) => {
    const atual = marc.find(m => String(m.ementa_id) === String(em.id))
    setOcupado(em.id); setErro('')
    try {
      if (atual?.prato_num === n) await mobileDesmarcar(sessao.token, em.id)
      else                        await mobileMarcar(sessao.token, em.id, n)
      setMarc(await mobileMarcacoes(sessao.token))
    } catch(ex) { falhou(ex) }
    setOcupado(null)
  }

  const s    = dados?.s
  const dias = dados ? refeicoesPorDia(dados.ementas, dados.fechados, s.servir_fds, today) : []

  return (
    <div style={page}>
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',margin:'8px 0 20px'}}>
        <Logo size="sm" showSub={false}/>
        <button onClick={onSair} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:99,color:C.textSub,fontSize:13,padding:'6px 14px'}}>Sair</button>
      </header>
      <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Olá, {sessao.nome.split(' ')[0]}</h1>
      <p style={{fontSize:14,color:C.textSub,marginBottom:20}}>Toca num prato para marcar; toca no escolhido para desmarcar.</p>
      {erro && <div role="alert" style={alerta}>{erro}</div>}

      {!dados ? <p style={{color:C.textMuted}}>A carregar…</p>
       : !dias.length ? <p style={{color:C.textMuted}}>Ainda não há ementas publicadas.</p>
       : dias.map(({data, refeicoes}) => (
        <section key={data} style={{marginBottom:24}}>
          <h2 style={{fontSize:13,fontWeight:800,color:data===today?C.yellow:C.textSub,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
            {data === today ? 'Hoje · ' : ''}{fmtF(data)}
          </h2>
          {refeicoes.map(em => {
            const locked = data === today && (s.bloquear_dia_proprio === 'true' || refeicaoTerminou(s, em.tipo, data, today))
            const m      = marc.find(x => String(x.ementa_id) === String(em.id))
            const pratos = [1,2,3,4].map(n => ({n, label:em[`prato${n}_label`], desc:em[`prato${n}_desc`]})).filter(p => p.label)
            return (
              <div key={em.id} style={{background:C.surface,border:`1px solid ${m ? C.yellow+'55' : C.border}`,borderRadius:14,padding:12,marginBottom:10}}>
                <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:10,gap:8}}>
                  <span style={{fontSize:16,fontWeight:700}}>{em.tipo === 'A' ? 'Almoço' : 'Jantar'} <span style={{fontSize:12,color:C.textMuted,fontWeight:400}}>{fmtHorario(s, em.tipo)}</span></span>
                  <span style={{fontSize:12,fontWeight:700,color:locked ? C.textMuted : m ? C.success : C.textMuted}}>
                    {locked ? '🔒 Fechado' : m ? 'Marcado' : 'Por marcar'}
                  </span>
                </div>
                <div style={{display:'grid',gap:8,opacity:ocupado === em.id ? 0.6 : 1}}>
                  {pratos.map(p => (
                    <PratoBtn key={p.n} slot={p.n} label={p.label} desc={p.desc} selected={m?.prato_num === p.n}
                      disabled={locked || ocupado === em.id} onClick={() => escolher(em, p.n)}/>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
