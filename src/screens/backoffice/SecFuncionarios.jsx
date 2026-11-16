import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { C } from '../../constants/colors'
import Avatar from '../../components/Avatar'
import Icon from '../../components/Icon'
import FuncionarioEditor, { PinEstado } from './FuncionarioEditor'
import { hashPin } from '../../utils/pin'
import { definirPinInicial } from '../../lib/queries'

const EYE = {fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:2}
const BIG = {fontStyle:'italic',fontSize:26,color:'#e2e8f0',lineHeight:1}

export default function SecFuncionarios({funcionarios, reload}) {
  const [editing, setEditing] = useState(null)
  const [search,  setSearch]  = useState('')
  const [deleting,     setDeleting]     = useState(null) // funcionário alvo de eliminação
  const [deleteError,  setDeleteError]  = useState('')

  const blank = {id:null, numero:'', nome:'', rfid:'', foto:null, ativo:true, acesso_mobile:false, tem_pin:false, pinNovo:''}

  // O PIN nunca sai do browser em texto: só o hash bcrypt.
  const save = async form => {
    const row = {numero:form.numero, nome:form.nome, rfid:form.rfid, foto_url:form.foto, ativo:form.ativo, acesso_mobile:!!form.acesso_mobile}
    if (form.pinNovo) Object.assign(row, {pin_hash:await hashPin(form.pinNovo), pin_alterado:false})
    const { error } = form.id
      ? await supabase.from('cantina_funcionarios').update(row).eq('id', form.id)
      : await supabase.from('cantina_funcionarios').insert(row)
    if (error) return error
    await reload()
    setEditing(null)
  }

  const resetPin = async (id, pin) => {
    const { error } = await definirPinInicial(id, await hashPin(pin))
    if (!error) await reload()
    return error
  }

  const confirmarDelete = async () => {
    if (!deleting) return
    const { error } = await supabase.from('cantina_funcionarios').delete().eq('id', deleting.id)
    if (error) {
      setDeleteError(error.code === '23503'
        ? 'Não é possível eliminar este funcionário porque tem marcações ou consumos registados.'
        : 'Ocorreu um erro ao eliminar o funcionário.')
      return
    }
    await reload()
    setDeleting(null)
    setDeleteError('')
  }

  const ativos   = funcionarios.filter(f => f.ativo).length
  const inativos = funcionarios.length - ativos
  const filtered = funcionarios.filter(f =>
    !search ||
    f.nome.toLowerCase().includes(search.toLowerCase()) ||
    String(f.numero).includes(search)
  ).sort((a, b) => parseInt(a.numero) - parseInt(b.numero))

  const cols = '40px 76px 1fr 92px 170px 120px 108px'

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>

      {/* ── Toolbar ── */}
      <div style={{padding:'14px 32px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:24}}>
          <div>
            <div style={EYE}>Equipa</div>
            <div style={BIG}>{funcionarios.length} funcionário{funcionarios.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{width:1,height:28,background:C.border}}/>
          <div style={{display:'flex',alignItems:'center',gap:10,fontSize:12,color:C.textSub}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:5}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:C.success}}/>
              {ativos} ativo{ativos !== 1 ? 's' : ''}
            </span>
            {inativos > 0 && <>
              <div style={{width:1,height:14,background:C.border}}/>
              <span style={{color:C.textMuted}}>{inativos} inativo{inativos !== 1 ? 's' : ''}</span>
            </>}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar…"
            style={{height:36,padding:'0 14px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:99,color:C.text,fontSize:13,width:190,outline:'none'}}
          />
          <button onClick={() => setEditing(blank)}
            style={{height:36,padding:'0 16px',background:C.yellow,border:'none',borderRadius:99,color:C.bg,fontSize:13,fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:7}}>
            + Novo funcionário
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{flex:1,overflow:'auto',padding:'20px 24px 24px'}}>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden'}}>

          {/* Header */}
          <div style={{display:'grid',gridTemplateColumns:cols,padding:'10px 18px',gap:12,background:C.surface2,borderBottom:`1px solid ${C.border}`,alignItems:'center'}}>
            {['','ID','Nome','Estado','RFID','PIN / Mobile',''].map((h,i) => (
              <div key={i} style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.1em',textAlign:i===1?'center':'left'}}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0
            ? <div style={{padding:'44px 0',textAlign:'center',color:C.textMuted,fontSize:13,fontStyle:'italic'}}>
                {search ? `Nenhum resultado para "${search}"` : 'Sem funcionários registados.'}
              </div>
            : filtered.map(f => (
              <div key={f.id}
                onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{display:'grid',gridTemplateColumns:cols,padding:'11px 18px',gap:12,borderTop:`1px solid ${C.border}`,alignItems:'center',transition:'background 0.1s'}}>

                <Avatar nome={f.nome || '?'} foto={f.foto || f.foto_url} size={32}/>

                <div style={{fontSize:13,fontWeight:600,color:C.textSub,textAlign:'center'}}>{f.numero}</div>

                <div style={{fontSize:14,fontWeight:600,color:C.text}}>{f.nome}</div>

                <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:99,display:'inline-flex',alignItems:'center',gap:4,
                  background: f.ativo ? C.successBg : C.surface2,
                  color:       f.ativo ? C.success   : C.textMuted,
                  border:     `1px solid ${f.ativo ? C.success+'33' : C.border}`}}>
                  <span style={{width:5,height:5,borderRadius:'50%',background: f.ativo ? C.success : C.textMuted}}/>
                  {f.ativo ? 'Ativo' : 'Inativo'}
                </span>

                <div style={{fontFamily:'monospace',fontSize:12,color:C.textSub,background:C.surface2,padding:'4px 9px',borderRadius:6,border:`1px solid ${C.border}`,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {f.rfid || <span style={{color:C.textMuted,fontStyle:'italic'}}>—</span>}
                </div>

                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:4}}>
                  <PinEstado f={f}/>
                  {f.acesso_mobile && <span style={{fontSize:11,fontWeight:700,color:C.yellow}}>📱 Mobile ativo</span>}
                </div>

                <div style={{display:'flex',gap:5,justifyContent:'flex-end'}}>
                  <button onClick={() => setEditing({...f})}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=`${C.yellow}55`; e.currentTarget.style.color=C.yellow }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textSub }}
                    style={{height:28,padding:'0 11px',background:'transparent',border:`1px solid ${C.border}`,borderRadius:99,fontSize:12,fontWeight:600,color:C.textSub,cursor:'pointer',transition:'all 0.15s'}}>
                    Editar
                  </button>
                  <button onClick={() => { setDeleting(f); setDeleteError('') }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=`${C.danger}55`; e.currentTarget.style.color=C.danger }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textMuted }}
                    style={{width:28,height:28,background:'transparent',border:`1px solid ${C.border}`,borderRadius:99,fontSize:12,color:C.textMuted,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}>
                    <Icon name="x" size={12} color="currentColor"/>
                  </button>
                </div>

              </div>
            ))
          }
        </div>
      </div>

      {/* ── Modal ── */}
      {editing !== null && (
        <>
          <div onClick={() => setEditing(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:40}}/>
          <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:50,width:520,background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:28,boxShadow:'0 32px 80px rgba(0,0,0,0.5)'}}>
            <FuncionarioEditor form={editing} onSave={save} onResetPin={resetPin} onCancel={() => setEditing(null)}/>
          </div>
        </>
      )}

      {/* ── Confirmação de eliminação ── */}
      {deleting !== null && (
        <>
          <div onClick={() => { setDeleting(null); setDeleteError('') }} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:40}}/>
          <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:50,width:400,background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:28,boxShadow:'0 32px 80px rgba(0,0,0,0.5)'}}>
            <div style={{fontSize:16,fontWeight:600,color:C.text}}>Eliminar {deleting.nome}?</div>
            {deleteError && (
              <div style={{marginTop:12,padding:'10px 12px',background:C.dangerBg,border:`1px solid ${C.danger}33`,borderRadius:10,fontSize:13,color:C.danger}}>
                {deleteError}
              </div>
            )}
            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button onClick={() => { setDeleting(null); setDeleteError('') }}
                style={{flex:1,height:38,background:'transparent',border:`1px solid ${C.border}`,borderRadius:99,color:C.textSub,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                Cancelar
              </button>
              <button onClick={confirmarDelete}
                style={{flex:1,height:38,background:C.danger,border:'none',borderRadius:99,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                Eliminar
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
