import { Fragment } from 'react'
import { C } from '../constants/colors'

// Linha discreta de KPIs: "42 marcações · 30 almoços · 12 jantares"
export default function KpiLine({items}) {
  return (
    <div style={{display:'flex',alignItems:'baseline',flexWrap:'wrap',gap:'4px 10px',fontSize:13,color:C.textSub}}>
      {items.map(({value,label},i) => (
        <Fragment key={label}>
          {i>0 && <span style={{color:C.textMuted}}>·</span>}
          <span><strong style={{fontSize:14,fontWeight:700,color:C.text}}>{value}</strong> {label}</span>
        </Fragment>
      ))}
    </div>
  )
}
