import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { contarMovimentos } from '../../lib/queries'
import { C } from '../../constants/colors'
import Icon from '../../components/Icon'

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
const btn = {flex:1,height:42,borderRadius:99,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}

// Eliminar só sem marcações nem consumos (são histórico de faturação). Com movimentos, propõe inativar.
export default function EliminarFuncionario({f, onClose, onDone}) {
  const [estado, setEstado] = useState('verificar')   // verificar | livre | movimentos | erro
  const [mov,    setMov]    = useState(null)
  const [busy,   setBusy]   = useState(false)

  useEffect(() => {
    contarMovimentos(f.id)
      .then(m => { setMov(m); setEstado(m.marcacoes + m.consumos ? 'movimentos' : 'livre') })
      .catch(() => setEstado('erro'))
  }, [f.id])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [busy, onClose])

  const eliminar = async () => {
    setBusy(true)
    const { error } = await supabase.from('cantina_funcionarios').delete().eq('id', f.id)
    setBusy(false)
    if (!error) return onDone()
    // Movimento criado entretanto (chave estrangeira): volta a contar e propõe inativar
    if (error.code === '23503') { setEstado('verificar'); contarMovimentos(f.id).then(m => { setMov(m); setEstado('movimentos') }).catch(() => setEstado('erro')) }
    else setEstado('erro')
  }

  const inativar = async () => {
    setBusy(true)
    const { error } = await supabase.from('cantina_funcionarios').update({ativo:false}).eq('id', f.id)
    setBusy(false)
    if (error) setEstado('erro'); else onDone()
  }

  const perigo = estado === 'livre'
  const cor    = perigo ? C.danger : estado === 'movimentos' ? C.warn : C.textSub

  return (
    <>
      <div onClick={busy ? undefined : onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:40}}/>
      <div role="alertdialog" aria-modal="true" aria-labelledby="elim-titulo" aria-describedby="elim-texto"
        style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:50,width:'min(440px, calc(100vw - 32px))',background:C.surface,border:`1px solid ${perigo ? C.danger+'66' : C.border}`,borderRadius:20,overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,0.6)'}}>

        {/* Faixa de cor: vermelho = eliminação definitiva; amarelo = não dá para eliminar */}
        <div style={{height:6,background:cor}}/>

        <div style={{padding:'24px 28px 28px'}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:52,height:52,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
              background: perigo ? C.dangerBg : estado === 'movimentos' ? C.warnBg : C.surface2, border:`1px solid ${cor}44`}}>
              <Icon name={estado === 'movimentos' || estado === 'erro' ? 'warn' : 'trash'} size={24} color={cor}/>
            </div>
            <div style={{minWidth:0}}>
              <div id="elim-titulo" style={{fontSize:19,fontWeight:800,color:C.text,lineHeight:1.25}}>
                {estado === 'movimentos' ? `Não é possível eliminar ${f.nome}` : `Eliminar ${f.nome}?`}
              </div>
              <div style={{fontSize:13,color:C.textMuted,marginTop:3}}>Nº {f.numero}</div>
            </div>
          </div>

          <div id="elim-texto" style={{marginTop:20,fontSize:14,lineHeight:1.55,color:C.textSub}}>
            {estado === 'verificar' && 'A verificar marcações e consumos…'}
            {estado === 'erro' && <span style={{color:C.danger}}>Não foi possível concluir a operação. Verifica a ligação e tenta novamente.</span>}
            {estado === 'livre' && (
              <div style={{padding:'12px 14px',background:C.dangerBg,border:`1px solid ${C.danger}44`,borderRadius:12,color:C.danger,fontWeight:600}}>
                A eliminação é definitiva. O funcionário não pode ser recuperado depois.
              </div>
            )}
            {estado === 'movimentos' && <>
              <div>Tem {plural(mov.marcacoes, 'marcação', 'marcações')} e {plural(mov.consumos, 'consumo', 'consumos')} registados.
                Estes registos fazem parte da faturação e têm de ser mantidos.</div>
              <div style={{marginTop:10}}>
                {f.ativo
                  ? 'Em vez de eliminar, pode inativá-lo: deixa de aparecer nos terminais e no mobile, e o histórico fica guardado.'
                  : 'O funcionário já está inativo.'}
              </div>
            </>}
          </div>

          <div style={{display:'flex',gap:10,marginTop:24}}>
            <button autoFocus onClick={onClose} disabled={busy}
              style={{...btn,background:'transparent',border:`1px solid ${C.border2}`,color:C.text}}>
              {estado === 'movimentos' && !f.ativo || estado === 'erro' ? 'Fechar' : 'Cancelar'}
            </button>
            {estado === 'livre' && (
              <button onClick={eliminar} disabled={busy}
                style={{...btn,background:C.danger,border:'none',color:'#fff',opacity:busy?0.6:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8}}>
                <Icon name="trash" size={16}/>{busy ? 'A eliminar…' : 'Eliminar definitivamente'}
              </button>
            )}
            {estado === 'movimentos' && f.ativo && (
              <button onClick={inativar} disabled={busy}
                style={{...btn,background:C.warn,border:'none',color:C.bg,opacity:busy?0.6:1}}>
                {busy ? 'A inativar…' : 'Inativar funcionário'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
