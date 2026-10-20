import { C } from '../constants/colors'
import { pratoColors, PRATO_GLYPHS as GLYPH } from '../constants/pratos'
import Icon from './Icon'

export default function PratoCard({slot,label,desc,selected,dim,locked,compact,onClick}) {
  const p = pratoColors(slot)
  return (
    <button onClick={onClick} disabled={locked}
      style={{position:'relative',textAlign:'left',padding:0,overflow:'hidden',cursor:locked?'default':'pointer',fontFamily:'inherit',
        borderRadius:18,display:'flex',flexDirection:'column',minHeight:0,minWidth:0,
        background:selected?C.yellow+'1A':C.bg,
        border:`3px solid ${selected?C.yellow:C.border2}`,
        opacity:dim?(locked?0.35:0.55):1,
        transition:'opacity .15s, border-color .15s, background .15s'}}>
      <div style={{height:50,flexShrink:0,background:p.bg,borderBottom:`1px solid ${p.bd}`,color:p.fg,display:'flex',alignItems:'center',gap:8,padding:'0 16px'}}>
        <Icon name={GLYPH[(slot-1)%GLYPH.length]||'utensils'} size={20}/>
        <span style={{fontSize:15,fontWeight:800,letterSpacing:'0.06em',textTransform:'uppercase',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{label}</span>
      </div>
      <div style={{flex:1,padding:'14px 18px',fontSize:compact?18:21,fontWeight:500,lineHeight:1.3,color:C.text,textWrap:'pretty',overflow:'hidden'}}>{desc}</div>
      {selected && (
        <span style={{position:'absolute',right:12,bottom:12,height:44,padding:'0 16px 0 10px',borderRadius:99,background:C.yellow,color:C.bg,display:'inline-flex',alignItems:'center',gap:6,fontSize:15,fontWeight:800}}>
          <Icon name={locked?'lock':'check'} size={20}/>Escolhido
        </span>
      )}
    </button>
  )
}
