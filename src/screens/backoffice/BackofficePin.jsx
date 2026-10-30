import { useState, useEffect } from 'react'
import { C } from '../../constants/colors'
import Keypad from '../../components/Keypad'
import Logo from '../../components/Logo'

const LEN = 6

// Porta do backoffice: PIN de 6 dígitos (cantina_definicoes.backoffice_pin). Sem recuperação — muda-se na BD.
export default function BackofficePin({pin, onOk, onBack}) {
  const [value, setValue] = useState('')
  const [err,   setErr]   = useState('')

  const check = v => {
    if (v.length < LEN) return
    if (v === String(pin)) { onOk(); return }
    setErr('PIN incorreto'); setValue('')
  }
  const change = v => { setErr(''); setValue(v); check(v) }

  useEffect(() => {
    const h = e => {
      if (e.key >= '0' && e.key <= '9') { if (value.length < LEN) change(value + e.key) }
      else if (e.key === 'Backspace') change(value.slice(0, -1))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
      {onBack && <button onClick={onBack} style={{position:'absolute',top:24,left:24,background:'none',border:'none',color:C.textMuted,fontSize:14,cursor:'pointer'}}>← Voltar</button>}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:24,padding:'36px 40px',width:440}}>
        <div style={{marginBottom:28}}><Logo size="md" showSub={true}/></div>
        <div style={{fontSize:13,color:C.textMuted,marginBottom:8}}>PIN do backoffice</div>
        <div role="group" aria-label="PIN" style={{display:'grid',gridTemplateColumns:`repeat(${LEN},1fr)`,gap:8,marginBottom:12}}>
          {Array.from({length:LEN}, (_,i) => (
            <div key={i} style={{height:60,borderRadius:12,background:C.surface3,border:`1.5px solid ${err?C.danger+'66':i===value.length?C.yellow:C.border2}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,color:C.yellow}}>
              {i < value.length ? '•' : ''}
            </div>
          ))}
        </div>
        {err && <div role="alert" style={{marginBottom:12,background:C.dangerBg,border:`1px solid ${C.danger}44`,borderRadius:8,padding:'8px 14px',fontSize:13,color:C.danger,textAlign:'center'}}>{err}</div>}
        <Keypad value={value} onChange={change} onConfirm={()=>check(value)} maxLen={LEN} confirmDisabled={value.length<LEN}/>
      </div>
    </div>
  )
}
