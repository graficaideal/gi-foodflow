-- Regras das marcações também no servidor para o terminal de marcações (rede de segurança: relógio errado, dados antigos).
-- Só as regras que o quiosque já cumpre: dia passado, dia encerrado, fim de semana com servir_fds=false, hoje com bloquear_dia_proprio.
-- Sem limite de hora no próprio dia (decisão: o quiosque marca a qualquer hora). O /mobile mantém o fim da refeição.
-- Fora: terminal de validações (marca durante a refeição), gestor e cron (sem papel). Seguro a qualquer hora.

begin;

-- O helper do /mobile ganha p_ate_fim: false = sem o limite do fim da refeição. Os chamadores atuais ficam iguais (default true).
drop function public._mobile_ementa_aberta(text);
create function public._mobile_ementa_aberta(p_ementa_id text, p_ate_fim boolean default true) returns public.cantina_ementas
language plpgsql security definer set search_path = public as $$
declare
  e cantina_ementas;
  agora timestamp := now() at time zone 'Europe/Lisbon';
begin
  select * into e from cantina_ementas where id::text = p_ementa_id;
  if not found or e.tipo not in ('A','J') then raise exception 'ementa_invalida'; end if;
  if e.data < agora::date
     or exists (select 1 from cantina_dias_fechados where data = e.data)
     or (extract(isodow from e.data) > 5 and _cantina_def('servir_fds','true') = 'false')
    then raise exception 'fechado'; end if;
  if e.data = agora::date then
    if _cantina_def('bloquear_dia_proprio','false') = 'true' then raise exception 'bloqueado_hoje'; end if;
    if p_ate_fim and agora::time > (case e.tipo when 'A' then _cantina_def('almoco_fim','14:30') else _cantina_def('jantar_fim','21:30') end)::time
      then raise exception 'terminou'; end if;
  end if;
  return e;
end $$;
revoke execute on function public._mobile_ementa_aberta(text, boolean) from public, anon, authenticated;

create or replace function public.cantina_marcacao_terminal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.papel() = 'marcacoes' then
    if tg_op <> 'INSERT' then perform _mobile_ementa_aberta(old.ementa_id::text, false); end if;
    if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.ementa_id <> old.ementa_id) then
      perform _mobile_ementa_aberta(new.ementa_id::text, false);
    end if;
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.cantina_marcacao_terminal() from public, anon, authenticated;

drop trigger if exists cantina_marcacao_terminal on public.cantina_marcacoes;
create trigger cantina_marcacao_terminal before insert or update or delete on public.cantina_marcacoes
  for each row execute function public.cantina_marcacao_terminal();

commit;
