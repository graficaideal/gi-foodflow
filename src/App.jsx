import { useState, useEffect, useCallback } from 'react'
import { fetchFuncionarios, fetchEmentas, fetchMarcacoesAll, fetchConsumos, fetchDefinicoes, fetchVisitantes } from './lib/queries'
import { DEFAULTS } from './constants/settings'
import { C } from './constants/colors'
import LoadingScreen from './components/LoadingScreen'
import Icon from './components/Icon'
import ModeSelector from './screens/ModeSelector'
import TerminalMarcacoes from './screens/marcacoes/TerminalMarcacoes'
import TerminalValidacoes from './screens/validacoes/TerminalValidacoes'
import Backoffice from './screens/backoffice/Backoffice'
import BackofficePin from './screens/backoffice/BackofficePin'

// Autenticação do backoffice dura a sessão do separador (sessionStorage)
const BO_KEY = 'ff_backoffice_ok'
const boAuthed = () => { try { return sessionStorage.getItem(BO_KEY) === '1' } catch(_) { return false } }

const getInitialMode = () => {
  try { const p=new URLSearchParams(window.location.search),m=p.get('mode'); if(['marcacoes','validacoes','backoffice'].includes(m)) return m } catch(_){}
  return 'selector'
}

export default function App() {
  const [mode,         setMode]         = useState(getInitialMode)
  const [loading,      setLoading]      = useState(true)
  const [loadErr,      setLoadErr]      = useState(null)
  const [funcionarios, setFuncionarios] = useState([])
  const [ementas,      setEmentas]      = useState([])
  const [marcacoesAll, setMarcacoesAll] = useState([])
  const [consumos,     setConsumos]     = useState([])
  const [visitantes,   setVisitantes]   = useState([])
  const [settings,     setSettings]     = useState(DEFAULTS)
  const [boOk,         setBoOk]         = useState(boAuthed)

  const reload = useCallback(async () => {
    try {
      setLoadErr(null)
      const [f,e,m,c,v,def] = await Promise.all([fetchFuncionarios(),fetchEmentas(),fetchMarcacoesAll(),fetchConsumos(),fetchVisitantes(),fetchDefinicoes()])
      setFuncionarios(f); setEmentas(e); setMarcacoesAll(m); setConsumos(c); setVisitantes(v); setSettings(def)
    } catch(_) { setLoadErr('Erro ao carregar dados.') }
  }, [])

  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  // Polling de definições a cada 60s (para os terminais verem alterações de horário)
  useEffect(() => {
    const id = setInterval(async () => {
      try { const def=await fetchDefinicoes(); setSettings(def) } catch(_) {}
    }, 60000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <LoadingScreen msg="A ligar ao servidor…"/>

  const ErrBar = () => loadErr ? (
    <div style={{position:'fixed',top:0,left:0,right:0,zIndex:99,padding:'8px 16px',background:C.dangerBg,borderBottom:`1px solid ${C.danger}44`,display:'flex',gap:12,alignItems:'center'}}>
      <Icon name="warn" size={14} color={C.danger}/>
      <span style={{fontSize:13,color:C.danger,flex:1}}>{loadErr}</span>
      <button onClick={reload} style={{fontSize:12,color:C.yellow,background:'none',border:`1px solid ${C.yellow}55`,borderRadius:6,padding:'3px 10px'}}>Tentar novamente</button>
    </div>
  ) : null

  const shared = {funcionarios,ementas,settings}

  if (mode==='selector')   return <ModeSelector onSelect={setMode}/>
  if (mode==='marcacoes')  return <><ErrBar/><TerminalMarcacoes  {...shared} reload={reload} onBack={()=>setMode('selector')}/></>
  if (mode==='validacoes') return <><ErrBar/><TerminalValidacoes {...shared} onBack={()=>setMode('selector')}/></>
  if (mode==='backoffice' && !boOk) return <BackofficePin pin={settings.backoffice_pin} onBack={()=>setMode('selector')}
    onOk={()=>{ try { sessionStorage.setItem(BO_KEY,'1') } catch(_) {} ; setBoOk(true) }}/>
  if (mode==='backoffice') return <><ErrBar/><Backoffice {...shared} marcacoesAll={marcacoesAll} consumos={consumos} visitantes={visitantes} reload={reload} onBack={()=>setMode('selector')}/></>
}
