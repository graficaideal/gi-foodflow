import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import { fetchFuncionarios, fetchEmentas, fetchMarcacoesAll, fetchConsumos, fetchDefinicoes, fetchVisitantes } from './lib/queries'
import { DEFAULTS } from './constants/settings'
import { C } from './constants/colors'
import useHoje from './hooks/useHoje'
import LoadingScreen from './components/LoadingScreen'
import Icon from './components/Icon'
import Login from './screens/Login'
import TerminalMarcacoes from './screens/marcacoes/TerminalMarcacoes'
import TerminalValidacoes from './screens/validacoes/TerminalValidacoes'
import Backoffice from './screens/backoffice/Backoffice'

// Cada conta tem um papel (auth app_metadata.papel) e um só ecrã. As permissões reais estão nas políticas RLS.
const MODO = { gestor:'backoffice', marcacoes:'marcacoes', validacoes:'validacoes' }
const sair = () => supabase.auth.signOut()

export default function App() {
  const [session,      setSession]      = useState(undefined)   // undefined = a verificar
  const [loading,      setLoading]      = useState(true)
  const [loadErr,      setLoadErr]      = useState(null)
  const [funcionarios, setFuncionarios] = useState([])
  const [ementas,      setEmentas]      = useState([])
  const [marcacoesAll, setMarcacoesAll] = useState([])
  const [consumos,     setConsumos]     = useState([])
  const [visitantes,   setVisitantes]   = useState([])
  const [settings,     setSettings]     = useState(DEFAULTS)

  useEffect(() => {
    const iniciar = async () => {
      // ponytail: /?sair=1 termina a sessão de um terminal; sem botão, para ninguém o desligar ao balcão
      const url = new URL(window.location.href)
      if (url.searchParams.get('sair') === '1') {
        await supabase.auth.signOut()
        url.searchParams.delete('sair')
        window.history.replaceState(null, '', url)   // mantém ?kiosk=1
      }
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
    }
    iniciar()
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const uid  = session?.user?.id
  const modo = MODO[session?.user?.app_metadata?.papel]

  // Marcações, consumos e visitantes (tabelas que crescem) só no backoffice; os terminais consultam o que precisam no momento.
  const reload = useCallback(async () => {
    try {
      setLoadErr(null)
      const bo = modo === 'backoffice'
      const [f,e,def,m,c,v] = await Promise.all([fetchFuncionarios(),fetchEmentas(),fetchDefinicoes(),
        ...(bo ? [fetchMarcacoesAll(),fetchConsumos(),fetchVisitantes()] : [])])
      setFuncionarios(f); setEmentas(e); setSettings(def)
      if (bo) { setMarcacoesAll(m); setConsumos(c); setVisitantes(v) }
    } catch(_) { setLoadErr('Erro ao carregar dados.') }
  }, [modo])

  // Recarrega ao entrar (ou ao mudar de conta); a renovação do token não muda o uid.
  useEffect(() => {
    if (!uid || !modo) return
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [uid, modo, reload])

  // Polling de definições a cada 60s (para os terminais verem alterações de horário)
  useEffect(() => {
    if (!uid) return
    const id = setInterval(async () => {
      try { const def=await fetchDefinicoes(); setSettings(def) } catch(_) {}
    }, 60000)
    return () => clearInterval(id)
  }, [uid])

  // Novo dia com a app aberta: traz ementas publicadas entretanto. Sem rede fetchEmentas devolve [] (máquina a acordar): mantém as que há.
  const today = useHoje()
  const diaCarregado = useRef(today)
  useEffect(() => {
    if (today===diaCarregado.current || !uid) return
    diaCarregado.current = today
    fetchEmentas().then(e => { if (e.length) setEmentas(e) })
  }, [today, uid])

  if (session === undefined) return <LoadingScreen msg="A verificar sessão…"/>
  if (!session)              return <Login/>
  if (!modo) return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,color:C.textSub}}>
      <div>A conta {session.user.email} não tem acesso a nenhum terminal.</div>
      <button onClick={sair} style={{height:40,padding:'0 18px',background:'transparent',border:`1px solid ${C.border}`,borderRadius:99,color:C.text}}>Terminar sessão</button>
    </div>
  )
  if (loading) return <LoadingScreen msg="A ligar ao servidor…"/>

  const ErrBar = () => loadErr ? (
    <div style={{position:'fixed',top:0,left:0,right:0,zIndex:99,padding:'8px 16px',background:C.dangerBg,borderBottom:`1px solid ${C.danger}44`,display:'flex',gap:12,alignItems:'center'}}>
      <Icon name="warn" size={14} color={C.danger}/>
      <span style={{fontSize:13,color:C.danger,flex:1}}>{loadErr}</span>
      <button onClick={reload} style={{fontSize:12,color:C.yellow,background:'none',border:`1px solid ${C.yellow}55`,borderRadius:6,padding:'3px 10px'}}>Tentar novamente</button>
    </div>
  ) : null

  const shared = {funcionarios,ementas,settings}

  if (modo==='marcacoes')  return <><ErrBar/><TerminalMarcacoes  {...shared} today={today} reload={reload}/></>
  if (modo==='validacoes') return <><ErrBar/><TerminalValidacoes {...shared} today={today} reload={reload}/></>
  return <><ErrBar/><Backoffice {...shared} marcacoesAll={marcacoesAll} consumos={consumos} visitantes={visitantes} reload={reload} onBack={sair}/></>
}
