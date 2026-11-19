import { useEffect } from 'react'
import { WD, MN } from '../utils/date'
import Logo from './Logo'
import Icon from './Icon'

export const ARR = { bg:'#151920', card:'#1a2028', surf:'#29333d', border:'#3a4550', ink:'#e8ecef', ink2:'#a4adb6', ink3:'#6c7680', accent:'#e0cb4b', accentText:'#1a2028' }

export default function LoginShell({leftPanel, value, secret=false, onChange, onConfirm, onBack, onRefresh, serialStatus, error, belowKeypad}) {
  const now = new Date()
  const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0')
  const dateStr = WD[now.getDay()] + ' ' + now.getDate() + ' ' + MN[now.getMonth()]
  const rfidActive = serialStatus === 'connected'
  const A = ARR
  const cell = {height:90,fontSize:30,fontWeight:500,background:A.surf,border:`1px solid ${A.border}`,borderRadius:18,color:A.ink,cursor:'pointer',fontFamily:'inherit'}

  useEffect(() => {
    const h = e => {
      if (e.key >= '0' && e.key <= '9') onChange(p => p.length < 10 ? p + e.key : p)
      else if (e.key === 'Backspace') onChange(p => p.slice(0, -1))
      else if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onChange, onConfirm])

  return (
    <div style={{height:'100vh',background:A.bg,color:A.ink,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
      <div style={{position:'absolute',inset:0,pointerEvents:'none',background:'radial-gradient(circle at 80% 10%, rgba(224,203,75,0.16) 0%, transparent 55%)'}} />
      <div style={{position:'absolute',top:0,left:0,right:0,padding:'24px 36px',display:'flex',alignItems:'center',justifyContent:'space-between',zIndex:2}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <Logo size="sm" />
          {onBack && <button onClick={onBack} style={{background:'none',border:`1px solid ${A.border}`,borderRadius:8,padding:'6px 14px',color:A.ink3,fontSize:12,cursor:'pointer',marginLeft:8}}>← Voltar</button>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16,fontSize:12,color:A.ink3}}>
          <span>Terminal · {dateStr} · {timeStr}</span>
          {rfidActive && (
            <span style={{display:'inline-flex',alignItems:'center',gap:6,color:'#34d399',fontWeight:700,fontSize:11,letterSpacing:'0.08em'}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:'#34d399',boxShadow:'0 0 6px #34d399'}} />
              RFID ATIVO
            </span>
          )}
          {onRefresh && (
            <button onClick={onRefresh} aria-label="Atualizar" style={{width:48,height:48,background:A.card,border:`1px solid ${A.border}`,borderRadius:12,color:A.ink,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
              <Icon name="refresh" size={22}/>
            </button>
          )}
        </div>
      </div>
      <div style={{flex:1,display:'flex',alignItems:'center',padding:'64px 80px 32px',gap:80,position:'relative',zIndex:1}}>
        <div style={{flex:1}}>{leftPanel}</div>
        <div style={{width:380}}>
          <div style={{fontSize:12,fontWeight:700,color:A.ink3,letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:10}}>
            {secret ? 'PIN' : 'Código'}
          </div>
          <div style={{background:A.card,border:`1px solid ${A.border}`,borderRadius:18,height:80,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}>
            <span style={{fontSize:56,letterSpacing:8,color:value ? A.ink : A.ink3,lineHeight:1}}>
              {value ? (secret ? '●'.repeat(value.length) : value) : '—'}
            </span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:10}}>
            {[1,2,3,4,5,6,7,8,9].map(d => (
              <button key={d} onClick={()=>onChange(p=>p.length<10?p+String(d):p)} style={cell}>{d}</button>
            ))}
            <button onClick={()=>onChange(p=>p.slice(0,-1))} style={{...cell,fontSize:24,color:A.ink3}}>⌫</button>
            <button onClick={()=>onChange(p=>p.length<10?p+'0':p)} style={{...cell,gridColumn:'span 2'}}>0</button>
            <button onClick={onConfirm} style={{...cell,gridColumn:'1 / -1',background:'#34d399',border:'none',color:'#0d2e22',fontWeight:800,letterSpacing:'0.08em'}}>ENTER</button>
          </div>
          {error && <div style={{marginTop:12,padding:'8px 12px',background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.3)',borderRadius:8,fontSize:13,color:'#f87171',textAlign:'center'}}>{error}</div>}
          {belowKeypad}
        </div>
      </div>
    </div>
  )
}
