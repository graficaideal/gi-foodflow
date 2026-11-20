import { useState, useEffect } from 'react'
import { C } from '../../constants/colors'
import { fmtF, fmtS, MN, MN_FULL } from '../../utils/date'
import { fmtHorario } from '../../utils/meal'
import { DEFAULTS } from '../../constants/settings'
import { pratoColors } from '../../constants/pratos'
import { fetchDiasFechados } from '../../lib/queries'
import { resumoHoje, proximosDias, diasSemEmenta, periodoMes, faturacao, variacao, consumosPorDia, topNaoConsumidos } from '../../utils/dashboard'
import { eur } from '../../utils/precos'
import useHoje from '../../hooks/useHoje'
import Avatar from '../../components/Avatar'
import Icon from '../../components/Icon'

// Cores dos gráficos: validadas com o dataviz (scripts/validate_palette.js, modo escuro, superfície C.surface, todos os pares)
const REF     = { A: { label: 'Almoço', icon: 'sun', cor: '#d97706' }, J: { label: 'Jantar', icon: 'moon', cor: '#7c6cf0' } }
const CONSUMO = '#1f9e89'
const TRACADO = `repeating-linear-gradient(135deg, ${CONSUMO} 0 2px, transparent 2px 5px)`   // não consumidas: mesmo tom, textura

const sub   = { fontSize: 12, color: C.textMuted }
const num   = { fontVariantNumeric: 'tabular-nums' }
const linha = { display: 'flex', alignItems: 'center', gap: 8 }
const diaMes = ([de, ate]) => { const [, m, d1] = de.split('-'), d2 = ate.split('-')[2]; return `${+d1}–${+d2} ${MN[+m - 1]}` }

function Cartao({ titulo, aside, children, flex }) {
  return (
    <section style={{ flex, minWidth: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>{titulo}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

// Barra horizontal fina com ponta arredondada; o valor fica sempre escrito ao lado
function Barra({ valor, max, cor }) {
  return (
    <div style={{ height: 10, background: C.surface2, borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${max ? valor / max * 100 : 0}%`, height: '100%', background: cor, borderRadius: '0 4px 4px 0', transition: 'width .3s ease-out' }}/>
    </div>
  )
}

function Legenda({ itens }) {
  return (
    <div style={{ ...linha, gap: 14, fontSize: 12, color: C.textSub }}>
      {itens.map(({ label, fundo }) => (
        <span key={label} style={linha}><span style={{ width: 12, height: 12, borderRadius: 3, background: fundo, border: `1px solid ${CONSUMO}` }}/>{label}</span>
      ))}
    </div>
  )
}

function Refeicao({ r, settings }) {
  const ref = REF[r.tipo]
  return (
    <div style={{ flex: '1 1 300px', minWidth: 0 }}>
      <div style={linha}>
        <Icon name={ref.icon} size={18} color={ref.cor}/>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{ref.label}</span>
        <span style={sub}>{fmtHorario(settings, r.tipo)}</span>
      </div>
      {!r.em ? <div style={{ ...sub, marginTop: 14 }}>Sem ementa para hoje.</div> : <>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '10px 0 4px' }}>
          <span style={{ ...num, fontSize: 40, fontWeight: 800, color: C.text, lineHeight: 1 }}>{r.marcadas}</span>
          <span style={{ fontSize: 14, color: C.textSub }}>{r.marcadas === 1 ? 'marcada' : 'marcadas'}</span>
        </div>
        <div style={{ ...num, fontSize: 13, color: C.textSub, marginBottom: 14 }}>
          <strong style={{ color: C.text }}>{r.validadas}</strong> validadas
          {r.naoConsumidas > 0 && <> · <strong style={{ color: C.text }}>{r.naoConsumidas}</strong> não consumidas</>}
          {' · '}<strong style={{ color: C.text }}>{r.porServir}</strong> por servir
          {r.visitantes > 0 && <> · <strong style={{ color: C.text }}>{r.visitantes}</strong> visitantes</>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 120px) 1fr 32px', gap: '8px 10px', alignItems: 'center' }}>
          {r.pratos.map(p => [
            <span key={`l${p.n}`} style={{ fontSize: 13, color: C.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>,
            <Barra key={`b${p.n}`} valor={p.marcadas} max={r.marcadas} cor={pratoColors(p.n).fg}/>,
            <span key={`v${p.n}`} style={{ ...num, fontSize: 13, fontWeight: 700, color: C.text, textAlign: 'right' }}>{p.marcadas}</span>,
          ])}
        </div>
      </>}
    </div>
  )
}

// Colunas empilhadas: consumidas (cheio) em baixo, não consumidas (tracejado) em cima, 2px de intervalo; tooltip ao passar
function ColunasConsumos({ dias }) {
  const [sel, setSel] = useState(null)
  if (!dias.length) return <div style={{ ...sub, padding: '24px 0' }}>Sem consumos nas últimas 4 semanas.</div>
  const max = Math.max(...dias.map(d => d.consumidas + d.naoConsumidas))
  const alto = 140
  return (
    <div>
      <div style={{ position: 'relative', height: alto, display: 'flex', alignItems: 'flex-end', gap: 4, borderBottom: `1px solid ${C.border2}` }}
        onMouseLeave={() => setSel(null)}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, borderTop: `1px dashed ${C.border}` }}/>
        <span style={{ ...sub, ...num, position: 'absolute', top: -16, left: 0, fontSize: 11 }}>{max}</span>
        {dias.map((d, i) => (
          <div key={d.data} onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)} onBlur={() => setSel(null)} tabIndex={0}
            aria-label={`${fmtS(d.data)}: ${d.consumidas} consumidas, ${d.naoConsumidas} não consumidas`}
            style={{ flex: 1, height: '100%', display: 'flex', justifyContent: 'center', outline: 'none', cursor: 'default', opacity: sel === null || sel === i ? 1 : 0.55, transition: 'opacity .15s' }}>
            {/* a fatia inteira é a área de hover; a coluna desenhada é fina */}
            <div style={{ width: '100%', maxWidth: 24, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: d.naoConsumidas && d.consumidas ? 2 : 0 }}>
              {d.naoConsumidas > 0 && <div style={{ height: `${d.naoConsumidas / max * 100}%`, background: TRACADO, border: `1px solid ${CONSUMO}`, borderRadius: '4px 4px 0 0' }}/>}
              {d.consumidas > 0 && <div style={{ height: `${d.consumidas / max * 100}%`, background: CONSUMO, borderRadius: d.naoConsumidas ? 0 : '4px 4px 0 0' }}/>}
            </div>
          </div>
        ))}
        {sel !== null && (
          <div role="tooltip" style={{ position: 'absolute', bottom: alto + 6, left: `${(sel + 0.5) / dias.length * 100}%`, transform: 'translateX(-50%)', background: C.surface3, border: `1px solid ${C.border2}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: C.textSub, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>{fmtS(dias[sel].data)}</div>
            <div style={num}><strong style={{ color: C.text }}>{dias[sel].consumidas}</strong> consumidas</div>
            <div style={num}><strong style={{ color: C.text }}>{dias[sel].naoConsumidas}</strong> não consumidas</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {dias.map(d => <span key={d.data} style={{ ...sub, ...num, flex: 1, fontSize: 10, textAlign: 'center' }}>{+d.data.slice(8)}</span>)}
      </div>
    </div>
  )
}

export default function SecDashboard({ funcionarios, ementas, marcacoes, consumos, visitantes, precos = [], settings, reload, onNavigate }) {
  const today = useHoje()
  const [fechados,   setFechados]   = useState([])
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => { fetchDiasFechados().then(setFechados) }, [today])

  const atualizar = async () => {
    setRefreshing(true)
    await Promise.all([reload(), fetchDiasFechados().then(setFechados)]).catch(() => {})
    setRefreshing(false)
  }

  const hojeR    = resumoHoje(ementas, marcacoes, consumos, visitantes, today)
  const proximos = proximosDias(ementas, marcacoes, fechados, today)
  const maxProx  = Math.max(1, ...proximos.flatMap(d => [d.A || 0, d.J || 0]))
  const semEmenta = diasSemEmenta(ementas, fechados, today)
  const semCartao = funcionarios.filter(f => f.ativo && !f.rfid)
  const mes      = periodoMes(today), anterior = periodoMes(today, -1)
  const fat      = faturacao(consumos, visitantes, ementas, mes, precos)
  const fatAnt   = faturacao(consumos, visitantes, ementas, anterior, precos)
  const comValor = precos.length > 0   // sem preço definido, o destaque é o número de refeições
  const delta    = comValor ? variacao(fat.valor, fatAnt.valor) : variacao(fat.total, fatAnt.total)
  const porDia   = consumosPorDia(consumos, visitantes, ementas, today)
  const top      = topNaoConsumidos(consumos, funcionarios, ementas, mes, precos)
  const nomeMes  = MN_FULL[+today.slice(5, 7) - 1]

  const alertas = [
    semEmenta.length > 0 && { key: 'ementas', texto: `${semEmenta.length} ${semEmenta.length === 1 ? 'dia útil sem ementa' : 'dias úteis sem ementa'}`,
      detalhe: semEmenta.map(fmtS).join(', '), acao: 'Abrir ementas' },
    semCartao.length > 0 && { key: 'funcs', texto: `${semCartao.length} ${semCartao.length === 1 ? 'funcionário ativo sem cartão' : 'funcionários ativos sem cartão'}`,
      detalhe: semCartao.slice(0, 3).map(f => f.nome).join(', ') + (semCartao.length > 3 ? ` e mais ${semCartao.length - 3}` : ''), acao: 'Abrir funcionários' },
    !comValor && { key: 'definicoes', texto: 'Preço por refeição não definido', detalhe: 'Os valores a faturar não são calculados.', acao: 'Abrir definições' },
    comValor && fat.semPreco > 0 && { key: 'definicoes', texto: `${fat.semPreco} ${fat.semPreco === 1 ? 'refeição' : 'refeições'} deste mês sem preço`,
      detalhe: 'São anteriores ao primeiro preço. Guarda um preço com uma data mais antiga.', acao: 'Abrir definições' },
  ].filter(Boolean)

  const btnSec = { height: 30, padding: '0 12px', background: 'transparent', border: `1px solid ${C.border2}`, borderRadius: 99, color: C.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 28px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <Cartao titulo={`Hoje, ${fmtF(today).replace(/^./, c => c.toLowerCase())}`} aside={
          <button onClick={atualizar} disabled={refreshing} style={{ ...btnSec, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'flex', animation: refreshing ? 'spin 0.8s linear infinite' : undefined }}><Icon name="refresh" size={14}/></span>Atualizar
          </button>}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 48px' }}>
            {hojeR.map(r => <Refeicao key={r.tipo} r={r} settings={{ ...DEFAULTS, ...settings }}/>)}
          </div>
        </Cartao>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <Cartao flex="1.6 1 440px" titulo="Próximos dias" aside={
            <div style={{ ...linha, gap: 14, fontSize: 12, color: C.textSub }}>
              {['A', 'J'].map(t => <span key={t} style={linha}><Icon name={REF[t].icon} size={14} color={REF[t].cor}/>{REF[t].label}</span>)}
            </div>}>
            {proximos.length === 0 ? <div style={sub}>Sem ementas publicadas para os próximos dias.</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: '14px 12px', alignItems: 'center' }}>
                {proximos.map(d => [
                  <span key={`d${d.data}`} style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{fmtS(d.data)}</span>,
                  <div key={`b${d.data}`} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {['A', 'J'].map(t => (
                      <div key={t} style={{ display: 'grid', gridTemplateColumns: '18px 1fr 32px', gap: 8, alignItems: 'center' }} title={`${REF[t].label}: ${d[t] ?? 'sem ementa'}`}>
                        <Icon name={REF[t].icon} size={13} color={REF[t].cor}/>
                        {d[t] === null ? <span style={{ ...sub, fontSize: 11 }}>sem ementa</span> : <Barra valor={d[t]} max={maxProx} cor={REF[t].cor}/>}
                        <span style={{ ...num, fontSize: 13, fontWeight: 700, color: C.text, textAlign: 'right' }}>{d[t] ?? ''}</span>
                      </div>
                    ))}
                  </div>,
                ])}
              </div>
            )}
          </Cartao>

          <Cartao flex="1 1 300px" titulo="Alertas">
            {alertas.length === 0
              ? <div style={{ ...linha, fontSize: 13, color: C.textSub }}><Icon name="check" size={16} color={C.success}/>Sem alertas.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {alertas.map(a => (
                    <div key={a.key} style={{ display: 'flex', gap: 10, padding: '12px 14px', background: C.warnBg, border: `1px solid ${C.warn}33`, borderRadius: 10 }}>
                      <Icon name="warn" size={17} color={C.warn}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{a.texto}</div>
                        <div style={{ fontSize: 12, color: C.textSub, marginTop: 3, lineHeight: 1.4 }}>{a.detalhe}</div>
                        <button onClick={() => onNavigate(a.key)} style={{ ...btnSec, marginTop: 10 }}>{a.acao}</button>
                      </div>
                    </div>
                  ))}
                </div>}
          </Cartao>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <Cartao flex="2 1 520px" titulo={`Faturação de ${nomeMes.toLowerCase()}`} aside={<span style={sub}>{diaMes(mes)}</span>}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '16px 40px', marginBottom: 28 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ ...num, fontSize: 40, fontWeight: 800, color: C.text, lineHeight: 1 }}>{comValor ? eur(fat.valor) : fat.total}</span>
                  <span style={{ fontSize: 14, color: C.textSub }}>{comValor ? `${fat.total} refeições a faturar` : 'refeições a faturar'}</span>
                </div>
                <div style={{ ...sub, marginTop: 6 }}>
                  {delta === null ? `Sem registos em ${diaMes(anterior)}` : <>
                    <strong style={{ color: C.text }}>{delta > 0 ? '▲' : delta < 0 ? '▼' : ''} {delta > 0 ? '+' : ''}{delta}%</strong> face a {diaMes(anterior)} ({comValor ? eur(fatAnt.valor) : fatAnt.total})
                  </>}
                </div>
              </div>
              {[['Validadas', 'validadas'], ['Não consumidas', 'naoConsumidas'], ['Visitantes', 'visitantes']].map(([l, k]) => (
                <div key={k}>
                  <div style={{ ...num, fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1 }}>{comValor ? eur(fat.valores[k]) : fat[k]}</div>
                  <div style={{ ...sub, marginTop: 4 }}>{comValor ? <><span style={{ ...num, color: C.textSub }}>{fat[k]}</span> {l.toLowerCase()}</> : l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>Consumos por dia, últimas 4 semanas</span>
              <Legenda itens={[{ label: 'Consumidas', fundo: CONSUMO }, { label: 'Não consumidas', fundo: TRACADO }]}/>
            </div>
            <ColunasConsumos dias={porDia}/>
          </Cartao>

          <Cartao flex="1 1 300px" titulo="Mais refeições não consumidas" aside={<span style={sub}>{diaMes(mes)}</span>}>
            {top.length === 0 ? <div style={{ ...linha, fontSize: 13, color: C.textSub }}><Icon name="check" size={16} color={C.success}/>Nenhuma refeição marcada ficou por consumir.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {top.map(({ f, total, valor }, i) => (
                  <div key={f.id} style={{ ...linha, gap: 10, padding: '9px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                    <Avatar nome={f.nome} foto={f.foto || f.foto_url} size={30}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nome}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>Nº {f.numero}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ ...num, fontSize: 15, fontWeight: 800, color: C.text }}>{total}</div>
                      {comValor && <div style={{ ...num, fontSize: 11, color: C.textMuted }}>{eur(valor)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Cartao>
        </div>

      </div>
    </div>
  )
}
