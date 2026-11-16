// O Supabase (PostgREST) devolve no máximo N linhas por pedido (Settings → API → Max rows, 1000 por omissão) e corta o resto
// sem erro. Pede páginas seguidas até vir uma vazia: funciona seja qual for o N. A consulta tem de ter ordem estável (id no fim).
export const todasAsLinhas = async (consulta, pagina = 1000) => {
  const linhas = []
  for (;;) {
    const { data, error } = await consulta().range(linhas.length, linhas.length + pagina - 1)
    if (error) throw error
    if (!data?.length) return linhas
    linhas.push(...data)
  }
}
