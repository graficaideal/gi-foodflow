// Ementas (almoço/jantar) de `data` em que o funcionário ainda não tem marcação; almoço primeiro.
export const refeicoesPorMarcar = (ementas, marcacoes, data) => {
  const marcadas = new Set(marcacoes.map(m => m.ementa_id))
  return ementas
    .filter(e => e.data === data && (e.tipo === 'A' || e.tipo === 'J') && !marcadas.has(e.id))
    .sort((a, b) => (a.tipo === 'A' ? -1 : 1) - (b.tipo === 'A' ? -1 : 1))
}
