import { useState } from 'react'
import { C } from '../constants/colors'
import { monthRange } from '../utils/date'
import Icon from './Icon'

export const pill = {height:34,padding:'0 14px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:99,color:C.text,fontSize:12,outline:'none',cursor:'pointer'}

const MODES = [{k:'atual',l:'Mês atual'},{k:'anterior',l:'Mês anterior'},{k:'entre',l:'Entre datas'}]

// Mês atual (defeito) | Mês anterior | Entre datas. onChange(início, fim) em 'YYYY-MM-DD'.
export function PeriodFilter({start, end, onChange}) {
  const [mode, setMode] = useState('atual')
  const pick = k => {
    setMode(k)
    if (k !== 'entre') onChange(...monthRange(k === 'atual' ? 0 : -1))
  }
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div style={{display:'flex',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:99,padding:3,gap:3}}>
        {MODES.map(o => {
          const on = mode === o.k
          return (
            <button key={o.k} type="button" onClick={() => pick(o.k)}
              style={{height:28,padding:'0 12px',fontSize:12,fontWeight:on?700:500,whiteSpace:'nowrap',cursor:'pointer',borderRadius:99,transition:'all 0.15s',
                background:on?`${C.yellow}18`:'transparent',color:on?C.yellow:C.textSub,border:`1px solid ${on?C.yellow+'44':'transparent'}`}}>
              {o.l}
            </button>
          )
        })}
      </div>
      {mode === 'entre' && <>
        <input type="date" value={start} max={end} onChange={e => onChange(e.target.value, end)} style={{...pill,width:134}}/>
        <span style={{fontSize:11,color:C.textMuted}}>→</span>
        <input type="date" value={end} min={start} onChange={e => onChange(start, e.target.value)} style={{...pill,width:134}}/>
      </>}
    </div>
  )
}

export function SearchInput({value, onChange, placeholder='Pesquisar funcionário…'}) {
  return (
    <div style={{position:'relative',display:'flex',alignItems:'center'}}>
      <span style={{position:'absolute',left:12,display:'inline-flex',pointerEvents:'none'}}><Icon name="search" size={14} color={C.textMuted}/></span>
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{...pill,width:210,paddingLeft:32,cursor:'text'}}/>
    </div>
  )
}
