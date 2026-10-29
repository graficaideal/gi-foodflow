-- Fecho automático das refeições (compromisso de marcação)
-- Marcação sem consumo → consumo com automatico = true, à hora de fim da refeição.
-- Correr uma vez no SQL Editor do Supabase.

-- 1. Flag que distingue "não consumido" de uma validação real
alter table public.cantina_consumos
  add column if not exists automatico boolean not null default false;

-- 2. Um só consumo por funcionário e refeição (falha se já houver duplicados de teste: apaga-os antes)
create unique index if not exists cantina_consumos_funcionario_ementa_uk
  on public.cantina_consumos (funcionario_id, ementa_id);

-- 3. Fecha as refeições de hoje e de ontem cujo horário já terminou (hora de Lisboa)
create or replace function public.fechar_refeicoes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  agora timestamp := now() at time zone 'Europe/Lisbon';
  inseridos integer;
begin
  with horario as (
    select
      coalesce(max(trim(both '"' from valor::text)) filter (where chave = 'almoco_fim'), '14:30')::time as almoco_fim,
      coalesce(max(trim(both '"' from valor::text)) filter (where chave = 'jantar_fim'), '21:30')::time as jantar_fim
    from cantina_definicoes
  ), novos as (
    insert into cantina_consumos (funcionario_id, ementa_id, prato_num, validado_em, automatico)
    select m.funcionario_id, m.ementa_id, m.prato_num,
           (e.data + case e.tipo when 'A' then h.almoco_fim else h.jantar_fim end) at time zone 'Europe/Lisbon',
           true
    from cantina_marcacoes m
    join cantina_ementas e on e.id = m.ementa_id
    cross join horario h
    where e.data between agora::date - 1 and agora::date   -- ponytail: só hoje e ontem; alarga se o cron puder parar mais tempo
      and e.data + case e.tipo when 'A' then h.almoco_fim else h.jantar_fim end < agora
      and not exists (select 1 from cantina_dias_fechados f where f.data = e.data)
      and not exists (select 1 from cantina_consumos c where c.funcionario_id = m.funcionario_id and c.ementa_id = m.ementa_id)
    on conflict (funcionario_id, ementa_id) do nothing
    returning 1
  )
  select count(*) into inseridos from novos;
  return inseridos;
end;
$$;

revoke execute on function public.fechar_refeicoes() from public, anon, authenticated;

-- 4. Agendar a cada 5 minutos
create extension if not exists pg_cron;
select cron.schedule('fechar-refeicoes', '*/5 * * * *', $$select public.fechar_refeicoes()$$);
