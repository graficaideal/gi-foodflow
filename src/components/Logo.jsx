import { C } from '../constants/colors'

export default function Logo({size='md',showSub=true}) {
  const z = size==='lg'?{i:36,m:28,s:11}:size==='sm'?{i:26,m:18,s:9}:{i:30,m:22,s:10}
  return (
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <img src="/app_gestaocantinas_amarelo.png" alt="FoodFlow" width={z.i} height={z.i} style={{flexShrink:0,transform:'scale(1.6)'}}/>
      <div>
        <span style={{fontSize:z.m*.58,fontWeight:700,color:C.text,letterSpacing:2}}>FOODFLOW</span>
        {showSub && <div style={{fontSize:z.s,color:C.textMuted,marginTop:1}}>Gestão de Cantina</div>}
      </div>
    </div>
  )
}
