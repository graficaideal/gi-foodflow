import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { parseEmentaCsv, decodeCsv } from '../../utils/ementaCsv'
import { C } from '../../constants/colors'
import Icon from '../../components/Icon'
import SecEmentas from './SecEmentas'
import SecFuncionarios from './SecFuncionarios'
import SecConsumos from './SecConsumos'
import SecMarcacoes from './SecMarcacoes'
import SecDefinicoes from './SecDefinicoes'

export default function Backoffice({funcionarios,ementas,marcacoesAll,consumos,visitantes,settings,reload,onBack}) {
  const [sec,setSec] = useState('ementas')
  const [importing,setImporting] = useState(false)
  const fileRef = useRef(null)

  const importCsv = async e => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reimportar o mesmo ficheiro
    if (!file) return
    setImporting(true)
    try {
      const {rows,skipped} = parseEmentaCsv(decodeCsv(await file.arrayBuffer()))
      const skippedMsg = skipped.length
        ? `\n${skipped.length} linhas descartadas (linhas ${skipped.slice(0,20).join(', ')}${skipped.length>20?', …':''})`
        : '\nNenhuma linha descartada'
      if (!rows.length) { alert(`Nenhuma refeição válida encontrada no ficheiro.${skippedMsg}`); return }
      const {error} = await supabase.from('cantina_ementas').upsert(rows,{onConflict:'data,tipo'})
      if (error) throw error
      await reload()
      alert(`${rows.length} refeições importadas${skippedMsg}`)
    } catch (err) {
      alert(`Erro ao importar ementa: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }
  const nav = [
    {key:'ementas',   icon:'calendar', label:'Ementas'},
    {key:'funcs',     icon:'users',    label:'Funcionários'},
    {key:'consumos',  icon:'chart',    label:'Consumos'},
    {key:'marcacoes', icon:'list',     label:'Marcações'},
    {key:'definicoes',icon:'gear',     label:'Definições'},
  ]
  return (
    <div style={{...(sec==='ementas'?{height:'100vh'}:{minHeight:'100vh'}),display:'flex'}}>
      {/* Rail */}
      <div style={{width:60,background:C.surface,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',alignItems:'center',paddingTop:14,flexShrink:0}}>
        <img src="/app_gestaocantinas_amarelo.png" alt="FoodFlow" width={36} height={36} style={{marginBottom:22,transform:'scale(1.6)'}}/>
        {nav.map(n => (
          <button key={n.key} title={n.label} onClick={()=>setSec(n.key)}
            style={{width:42,height:42,borderRadius:10,margin:'3px 0',display:'flex',alignItems:'center',justifyContent:'center',
              background:sec===n.key?`${C.yellow}18`:'transparent',
              border:`1.5px solid ${sec===n.key?C.yellow:'transparent'}`,
              transition:'all .15s',cursor:'pointer'}}>
            <Icon name={n.icon} size={19} color={sec===n.key?C.yellow:C.textMuted}/>
          </button>
        ))}
        <div style={{flex:1}}/>
        <button title="Sair" onClick={onBack}
          style={{width:42,height:42,borderRadius:10,margin:'0 0 14px',display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'none',cursor:'pointer'}}>
          <Icon name="logout" size={18} color={C.textMuted}/>
        </button>
      </div>

      {/* Main */}
      <div style={{flex:1,display:'flex',flexDirection:'column',background:C.bg,overflow:'hidden'}}>
        {/* Topbar */}
        <div style={{height:60,flexShrink:0,background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'baseline',gap:10}}>
            <span style={{fontSize:18,fontWeight:800,color:C.text}}>{nav.find(n=>n.key===sec)?.label}</span>
            <span style={{fontSize:13,color:C.textMuted}}>FoodFlow · Backoffice</span>
          </div>
          {sec==='ementas' && (<>
            <input ref={fileRef} type="file" accept=".csv" onChange={importCsv} style={{display:'none'}}/>
            <button onClick={()=>fileRef.current.click()} disabled={importing}
              style={{height:38,padding:'0 16px',background:C.yellow,border:'none',borderRadius:9,color:'#0d1117',fontSize:14,fontWeight:700,display:'inline-flex',alignItems:'center',gap:8,cursor:importing?'wait':'pointer',opacity:importing?0.6:1,fontFamily:'inherit'}}>
              <Icon name="upload" size={16} color="#0d1117"/>{importing ? 'A importar...' : 'Importar Ementa'}
            </button>
          </>)}
        </div>

        {/* Content */}
        {sec==='ementas'
          ? <SecEmentas ementas={ementas} reload={reload} marcacoesAll={marcacoesAll} settings={settings}/>
          : <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              {sec==='funcs'     && <SecFuncionarios funcionarios={funcionarios} reload={reload}/>}
              {sec==='consumos'  && <SecConsumos consumos={consumos} visitantes={visitantes} funcionarios={funcionarios} ementas={ementas}/>}
              {sec==='marcacoes' && <SecMarcacoes marcacoes={marcacoesAll} funcionarios={funcionarios} ementas={ementas}/>}
              {sec==='definicoes'&& <SecDefinicoes settings={settings} reload={reload}/>}
            </div>
        }
      </div>
    </div>
  )
}
