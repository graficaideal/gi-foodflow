import { useState } from 'react'
import { C } from '../../constants/colors'
import { FIRST_MONTH, LAST_MONTH, TODAY, fmtS, fmtHM } from '../../utils/date'
import Avatar from '../../components/Avatar'
import PratoTag from '../../components/PratoTag'
import Icon from '../../components/Icon'
import KpiLine from '../../components/KpiLine'
import { HEADERS, exportRows, exportSummary, printHtml } from '../../utils/consumosExport'

const COLS = '1fr 120px 95px 105px 60px 72px'
const TH   = {fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.1em'}

export default function SecConsumos({consumos, visitantes=[], funcionarios, ementas}) {
  const [fStart, setFStart] = useState(FIRST_MONTH())
  const [fEnd,   setFEnd]   = useState(LAST_MONTH())
  const [fMeal,  setFMeal]  = useState('')
  const [fEstado,setFEstado]= useState('')   // '' | 'C' consumidos | 'N' não consumidos (automatico)

  const enriched = consumos.map(c => {
    const fn = funcionarios.find(f => f.id === c.funcionario_id)
    const em = ementas.find(e => e.id === c.ementa_id)
    if (!fn || !em) return null
    const pk = `prato${c.prato_num}`
    return {...c, nome:fn.nome, foto:fn.foto||fn.foto_url, numero:fn.numero, data:em.data, tipo:em.tipo, pratoLabel:em[pk+'_label'], pratoDesc:em[pk+'_desc']}
  }).filter(Boolean)

  const filtered = enriched.filter(c =>
    (!fStart || c.data >= fStart) &&
    (!fEnd   || c.data <= fEnd)   &&
    (!fMeal  || c.tipo === fMeal) &&
    (!fEstado || (fEstado === 'N') === !!c.automatico)
  )

  const enrichedVisitantes = visitantes.map(v => {
    const em = ementas.find(e => e.id === v.ementa_id)
    if (!em) return null
    const pk = `prato${v.prato_num}`
    return {...v, data:em.data, tipo:em.tipo, pratoLabel:em[pk+'_label']}
  }).filter(Boolean)

  const filteredVisitantes = enrichedVisitantes.filter(v =>
    (!fStart || v.data >= fStart) &&
    (!fEnd   || v.data <= fEnd)   &&
    (!fMeal  || v.tipo === fMeal) &&
    fEstado !== 'N'   // visitantes contam sempre como consumidos
  )

  const sorted = [
    ...filtered.map(c => ({key:`c-${c.id}`, ts:c.validado_em, data:c.data, tipo:c.tipo, pratoNum:c.prato_num, pratoLabel:c.pratoLabel, quantidade:1, nome:c.nome, foto:c.foto, numero:c.numero, automatico:c.automatico})),
    ...filteredVisitantes.map(v => ({key:`v-${v.id}`, ts:v.registado_em, data:v.data, tipo:v.tipo, pratoNum:v.prato_num, pratoLabel:v.pratoLabel, quantidade:v.quantidade})),
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts))

  const visQtd  = tipo => filteredVisitantes.filter(v => !tipo || v.tipo === tipo).reduce((s,v)=>s+v.quantidade,0)
  const funcQtd = tipo => filtered.filter(c => !tipo || c.tipo === tipo).length

  const stats = {
    total: funcQtd() + visQtd(),
    a: funcQtd('A') + visQtd('A'),
    j: funcQtd('J') + visQtd('J'),
    funcionarios: funcQtd(),
    visitantes: visQtd(),
    naoConsumidos: filtered.filter(c => c.automatico).length,
  }

  const exportar = async formato => {
    const rows = exportRows(sorted), summary = exportSummary({fStart,fEnd,fMeal,fEstado,stats})
    if (formato === 'pdf') {
      const win = window.open('', '_blank')
      if (!win) return
      win.document.write(printHtml(rows, summary)); win.document.close()
      win.onafterprint = () => win.close()
      win.focus(); win.print()
      return
    }
    const XLSX = await import('xlsx')   // ponytail: carregado só ao exportar (~400 KB)
    const ws = XLSX.utils.aoa_to_sheet([...summary.map(s => [s]), [], HEADERS, ...rows])
    ws['!cols'] = [6, 30, 10, 10, 8].map(wch => ({wch}))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Consumos')
    XLSX.writeFile(wb, `consumos_por_funcionario_${fStart||'inicio'}_${fEnd||'fim'}.xlsx`)
  }

  const pill = {height:34,padding:'0 14px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:99,color:C.text,fontSize:12,outline:'none',cursor:'pointer'}

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>

      {/* ── Toolbar ── */}
      <div style={{padding:'14px 32px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:24,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>

        {/* Stats */}
        <KpiLine items={[{value:stats.total,label:'consumos'},{value:stats.a,label:'almoços'},{value:stats.j,label:'jantares'},{value:stats.funcionarios,label:'funcionários'},{value:stats.visitantes,label:'visitantes'},{value:stats.naoConsumidos,label:'não consumidos'}]}/>

        {/* Filters */}
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <input type="date" value={fStart} onChange={e => setFStart(e.target.value)} style={{...pill,width:134}}/>
          <span style={{fontSize:11,color:C.textMuted}}>→</span>
          <input type="date" value={fEnd}   onChange={e => setFEnd(e.target.value)}   style={{...pill,width:134}}/>
          <select value={fMeal} onChange={e => setFMeal(e.target.value)} style={{...pill,width:128}}>
            <option value="">Todas</option>
            <option value="A">Almoço</option>
            <option value="J">Jantar</option>
          </select>
          <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={{...pill,width:150}}>
            <option value="">Todos os estados</option>
            <option value="C">Consumidos</option>
            <option value="N">Não consumidos</option>
          </select>
          <button onClick={() => {setFStart(TODAY);setFEnd(TODAY)}}
            style={{...pill,color:C.yellow,border:`1px solid ${C.yellow}44`,background:'transparent',fontWeight:700}}>
            Hoje
          </button>
          <button onClick={() => {setFStart(FIRST_MONTH());setFEnd(LAST_MONTH());setFMeal('');setFEstado('')}}
            style={{...pill,padding:'0 12px',color:C.textMuted,background:'transparent',border:`1px solid ${C.border}`}}>
            Limpar
          </button>
          {['pdf','xlsx'].map(f => (
            <button key={f} onClick={() => exportar(f)} disabled={!sorted.length}
              style={{...pill,padding:'0 12px',color:C.textSub,background:'transparent',display:'inline-flex',alignItems:'center',gap:6,opacity:sorted.length?1:0.4,cursor:sorted.length?'pointer':'default'}}>
              <Icon name="download" size={13} color={C.textSub}/>{f === 'pdf' ? 'PDF' : 'Excel'}
            </button>
          ))}
        </div>

      </div>

      {/* ── Content ── */}
      <div style={{flex:1,overflow:'auto',padding:'20px 24px 24px'}}>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden'}}>

          {/* Header */}
          <div style={{display:'grid',gridTemplateColumns:COLS,padding:'10px 18px',gap:14,background:C.surface2,borderBottom:`1px solid ${C.border}`,alignItems:'center'}}>
            {['Funcionário','Data','Refeição','Prato','Qtd','Hora'].map(h => (
              <div key={h} style={TH}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {sorted.length === 0
            ? <div style={{padding:'44px 0',textAlign:'center',color:C.textMuted,fontSize:13,fontStyle:'italic'}}>
                {consumos.length === 0 && visitantes.length === 0 ? 'Sem consumos registados.' : 'Sem registos para os filtros aplicados.'}
              </div>
            : sorted.map(c => (
              <div key={c.key}
                onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{display:'grid',gridTemplateColumns:COLS,padding:'10px 18px',gap:14,borderTop:`1px solid ${C.border}`,alignItems:'center',transition:'background 0.1s'}}>
                {c.nome
                  ? <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <Avatar nome={c.nome} foto={c.foto} size={30}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:C.text,display:'flex',alignItems:'center',gap:8}}>
                          {c.nome}
                          {c.automatico && <span title="Marcou mas não validou; registado no fecho da refeição"
                            style={{fontSize:10,fontWeight:700,letterSpacing:'0.04em',padding:'2px 7px',borderRadius:99,color:C.warn,background:`${C.warn}1a`,border:`1px solid ${C.warn}44`}}>NÃO CONSUMIDO</span>}
                        </div>
                        <div style={{fontSize:11,color:C.textMuted}}>Nº {c.numero}</div>
                      </div>
                    </div>
                  : <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:30,height:30,borderRadius:'50%',background:C.surface2,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <Icon name="users" size={15} color={C.textMuted}/>
                      </div>
                      <div style={{fontSize:13,fontStyle:'italic',color:C.textSub}}>Visitante(s)</div>
                    </div>
                }
                <div style={{fontSize:12,color:C.textSub}}>{fmtS(c.data)}</div>
                <div style={{fontSize:13,color:C.textSub}}>{c.tipo === 'A' ? '🌞 Almoço' : '🌙 Jantar'}</div>
                <PratoTag slot={c.pratoNum} label={c.pratoLabel}/>
                <div style={{fontSize:c.nome?12:15,fontWeight:c.nome?400:800,color:c.nome?C.textMuted:C.yellow,fontFamily:c.nome?'monospace':'inherit'}}>{c.quantidade}</div>
                <div style={{fontSize:12,color:C.textMuted,fontFamily:'monospace'}}>{fmtHM(c.ts)}</div>
              </div>
            ))
          }
        </div>
      </div>

    </div>
  )
}
