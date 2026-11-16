import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../constants/colors'
import Logo from '../components/Logo'

const lS = {fontSize:11,fontWeight:700,color:C.textMuted,display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.08em'}
const iS = {width:'100%',height:46,padding:'0 14px',borderRadius:10,border:`1px solid ${C.border}`,background:C.surface3,fontSize:15,marginBottom:14}

// Gestores e terminais. A sessão fica guardada no browser (terminais: login uma vez).
export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [erro,     setErro]     = useState('')
  const [busy,     setBusy]     = useState(false)

  const entrar = async e => {
    e.preventDefault()
    setBusy(true); setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setErro(error.status === 400 ? 'Email ou password incorretos.' : 'Sem ligação ao servidor.')
    setBusy(false)   // com sucesso, o App muda de ecrã via onAuthStateChange
  }

  return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <form onSubmit={entrar} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:24,padding:'36px 40px',width:'100%',maxWidth:440}}>
        <div style={{marginBottom:28}}><Logo size="md"/></div>
        {erro && <div role="alert" style={{marginBottom:14,background:C.dangerBg,border:`1px solid ${C.danger}44`,borderRadius:8,padding:'8px 14px',fontSize:13,color:C.danger}}>{erro}</div>}
        <label style={lS} htmlFor="l-email">Email</label>
        <input id="l-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required style={iS}/>
        <label style={lS} htmlFor="l-pass">Password</label>
        <input id="l-pass" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required style={iS}/>
        <button disabled={busy} style={{width:'100%',height:46,marginTop:6,border:'none',borderRadius:99,background:C.yellow,color:C.bg,fontSize:15,fontWeight:800,opacity:busy?0.6:1}}>
          {busy ? 'A entrar…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
