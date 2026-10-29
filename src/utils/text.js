// Minúsculas e sem acentos, para pesquisas ("João" ≈ "joao")
export const norm = s => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

// Pesquisa por nome ou Nº de funcionário; pesquisa vazia aceita tudo
export const matchFunc = (q, {nome, numero}) => !norm(q) || norm(nome).includes(norm(q)) || norm(numero).includes(norm(q))
