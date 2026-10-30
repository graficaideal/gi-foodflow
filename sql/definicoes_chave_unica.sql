-- cantina_definicoes: uma linha por chave
-- O upsert do saveDefinicao não tinha alvo de conflito e cada gravação criava linhas novas.
-- Correr uma vez no SQL Editor do Supabase, ANTES de publicar o código com onConflict:'chave'.

begin;

-- 1. Apaga os duplicados; fica a linha mais recente de cada chave
delete from public.cantina_definicoes d
using (
  select ctid, row_number() over (partition by chave order by updated_at desc nulls last, ctid desc) as rn
  from public.cantina_definicoes
) x
where d.ctid = x.ctid and x.rn > 1;

-- 2. Impede que voltem a aparecer
alter table public.cantina_definicoes
  add constraint cantina_definicoes_chave_key unique (chave);

commit;
