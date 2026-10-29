import { useState } from 'react'
import { C } from '../../constants/colors'
import { FIRST_MONTH, LAST_MONTH, TODAY, fmtS } from '../../utils/date'
import Avatar from '../../components/Avatar'
import PratoTag from '../../components/PratoTag'
import KpiLine from '../../components/KpiLine'

const TH   = {fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.1em'}

export default function SecMarcacoes({marcacoes, funcionarios, ementas}) {
  const [fStart, setFStart] = useState(FIRST_MONTH())
  const [fEnd,   setFEnd]   = useState(LAST_MONTH())
  const [fMeal,  setFMeal]  = useState('')
  const [view,   setView]   = useState('funcionario')

  const enriched = marcacoes.map(m => {
    const fn = funcionarios.find(f => f.id === m.funcionario_id)
    const em = ementas.find(e => e.id === m.ementa_id)
    if (!fn || !em) return null
    const pk = `prato${m.prato_num}`
    return {...m, nome:fn.nome, foto:fn.foto||fn.foto_url, numero:fn.numero, data:em.data, tipo:em.tipo, pratoLabel:em[pk+'_label'], pratoDesc:em[pk+'_desc']}
  }).filter(Boolean)

  const filtered = enriched.filter(m =>
    (!fStart || m.data >= fStart) &&
    (!fEnd   || m.data <= fEnd)   &&
    (!fMeal  || m.tipo === fMeal)
  )
  const stats   = {total:filtered.length, a:filtered.filter(m=>m.tipo==='A').length, j:filtered.filter(m=>m.tipo==='J').length}
  const byFunc  = [...filtered].sort((a, b) => a.nome.localeCompare(b.nome, 'pt') || (a.data < b.data ? -1 : 1))
  const byDate  = tipo => [...filtered].filter(m => m.tipo === tipo).sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : a.nome.localeCompare(b.nome, 'pt'))

  const pill = {height:34,padding:'0 14px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:99,color:C.text,fontSize:12,outline:'none',cursor:'pointer'}

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>

      {/* ── Toolbar ── */}
      <div style={{padding:'14px 32px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>

        {/* Stats */}
        <KpiLine items={[{value:stats.total,label:'marcações'},{value:stats.a,label:'almoços'},{value:stats.j,label:'jantares'}]}/>

        {/* Filters + view toggle */}
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <input type="date" value={fStart} onChange={e => setFStart(e.target.value)} style={{...pill,width:134}}/>
          <span style={{fontSize:11,color:C.textMuted}}>→</span>
          <input type="date" value={fEnd}   onChange={e => setFEnd(e.target.value)}   style={{...pill,width:134}}/>
          <select value={fMeal} onChange={e => setFMeal(e.target.value)} style={{...pill,width:112}}>
            <option value="">Todas</option>
            <option value="A">Almoço</option>
            <option value="J">Jantar</option>
          </select>
          <button onClick={() => {setFStart(TODAY);setFEnd(TODAY)}}
            style={{...pill,color:C.yellow,border:`1px solid ${C.yellow}44`,background:'transparent',fontWeight:700}}>
            Hoje
          </button>
          <button onClick={() => {setFStart(FIRST_MONTH());setFEnd(LAST_MONTH());setFMeal('')}}
            style={{...pill,padding:'0 12px',color:C.textMuted,background:'transparent',border:`1px solid ${C.border}`}}>
            Limpar
          </button>
          <div style={{width:1,height:24,background:C.border,margin:'0 4px'}}/>
          {/* View toggle */}
          <div style={{display:'flex',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:99,padding:3,gap:3}}>
            {[{k:'funcionario',l:'Por funcionário'},{k:'refeicao',l:'Por refeição'}].map(o => (
              <button key={o.k} onClick={() => setView(o.k)}
                style={{height:28,padding:'0 12px',fontSize:12,fontWeight: view===o.k ? 700 : 500,
                  background: view===o.k ? `${C.yellow}18` : 'transparent',
                  color:      view===o.k ? C.yellow : C.textSub,
                  border:     `1px solid ${view===o.k ? C.yellow+'44' : 'transparent'}`,
                  borderRadius:99,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap'}}>
                {o.l}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ── Content ── */}
      <div style={{flex:1,overflow:'auto',padding:'20px 24px 24px'}}>

        {/* View: Por funcionário */}
        {view === 'funcionario' && (
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 120px 72px 105px 1fr',padding:'10px 18px',gap:14,background:C.surface2,borderBottom:`1px solid ${C.border}`,alignItems:'center'}}>
              {['Funcionário','Data','Ref.','Prato','Descrição'].map(h => <div key={h} style={TH}>{h}</div>)}
            </div>
            {byFunc.length === 0
              ? <div style={{padding:'44px 0',textAlign:'center',color:C.textMuted,fontSize:13,fontStyle:'italic'}}>Sem marcações para os filtros aplicados.</div>
              : byFunc.map((m, i) => (
                <div key={i}
                  onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  style={{display:'grid',gridTemplateColumns:'1fr 120px 72px 105px 1fr',padding:'10px 18px',gap:14,borderTop:`1px solid ${C.border}`,alignItems:'center',transition:'background 0.1s'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <Avatar nome={m.nome} foto={m.foto} size={28}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:C.text}}>{m.nome}</div>
                      <div style={{fontSize:11,color:C.textMuted}}>Nº {m.numero}</div>
                    </div>
                  </div>
                  <div style={{fontSize:12,color:C.textSub}}>{fmtS(m.data)}</div>
                  <div style={{fontSize:13}}>{m.tipo === 'A' ? '🌞' : '🌙'}</div>
                  <PratoTag slot={m.prato_num} label={m.pratoLabel}/>
                  <div style={{fontSize:12,color:C.textSub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.pratoDesc}</div>
                </div>
              ))
            }
          </div>
        )}

        {/* View: Por refeição */}
        {view === 'refeicao' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            {[{tipo:'A',emoji:'🌞',label:'Almoço'},{tipo:'J',emoji:'🌙',label:'Jantar'}].map(({tipo,emoji,label}) => {
              if (fMeal && fMeal !== tipo) return null
              const rows = byDate(tipo)
              return (
                <div key={tipo} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden'}}>
                  {/* Card header */}
                  <div style={{padding:'14px 18px',background:C.surface2,borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                      <span style={{fontSize:20}}>{emoji}</span>
                      <span style={{fontStyle:'italic',fontSize:20,color:C.text}}>{label}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:7,fontSize:12,color:C.textSub}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:C.success,flexShrink:0}}/>
                      {rows.length} marcaç{rows.length !== 1 ? 'ões' : 'ão'}
                    </div>
                  </div>
                  {rows.length === 0
                    ? <div style={{padding:'28px 0',textAlign:'center',color:C.textMuted,fontSize:13,fontStyle:'italic'}}>Sem marcações</div>
                    : <>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 110px 100px',padding:'8px 18px',gap:12,borderBottom:`1px solid ${C.border}`,alignItems:'center'}}>
                          {['Funcionário','Data','Prato'].map(h => <div key={h} style={TH}>{h}</div>)}
                        </div>
                        {rows.map((m, i) => (
                          <div key={i}
                            onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            style={{display:'grid',gridTemplateColumns:'1fr 110px 100px',padding:'9px 18px',gap:12,borderTop:`1px solid ${C.border}`,alignItems:'center',transition:'background 0.1s'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <Avatar nome={m.nome} foto={m.foto} size={26}/>
                              <span style={{fontSize:13,fontWeight:500,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.nome}</span>
                            </div>
                            <div style={{fontSize:12,color:C.textSub}}>{fmtS(m.data)}</div>
                            <PratoTag slot={m.prato_num} label={m.pratoLabel}/>
                          </div>
                        ))}
                      </>
                  }
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
