-- Autenticação — PARTE A (aditiva). Correr ANTES do deploy do frontend com login.
-- Junta políticas para contas autenticadas por papel; o "allow all" atual continua até à parte B.
-- Papéis em auth.users.raw_app_meta_data.papel (sql/auth_papeis.sql): gestor | marcacoes | validacoes.

begin;

-- 1. Helpers usados nas políticas
create or replace function public.papel() returns text
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'papel', '')
$$;

create or replace function public.hoje_lisboa() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Lisbon')::date
$$;

-- 2. Leitura
-- Ementas, definições e dias encerrados: também o anon (o /mobile lê-os sem conta). Nada sensível depois de apagar backoffice_pin (parte B).
create policy "ler: todos" on public.cantina_ementas       for select to anon, authenticated using (true);
create policy "ler: todos" on public.cantina_definicoes    for select to anon, authenticated using (true);
create policy "ler: todos" on public.cantina_dias_fechados for select to anon, authenticated using (true);

create policy "ler: contas da cantina" on public.cantina_funcionarios for select to authenticated
  using ((select public.papel()) in ('gestor','marcacoes','validacoes'));
create policy "ler: contas da cantina" on public.cantina_marcacoes    for select to authenticated
  using ((select public.papel()) in ('gestor','marcacoes','validacoes'));
create policy "ler: contas da cantina" on public.cantina_consumos     for select to authenticated
  using ((select public.papel()) in ('gestor','marcacoes','validacoes'));
create policy "ler: contas da cantina" on public.cantina_visitantes   for select to authenticated
  using ((select public.papel()) in ('gestor','marcacoes','validacoes'));

-- 3. Gestor (backoffice): funcionários, ementas, definições, dias encerrados
create policy "gestor: escrever" on public.cantina_funcionarios  for all to authenticated
  using ((select public.papel()) = 'gestor') with check ((select public.papel()) = 'gestor');
create policy "gestor: escrever" on public.cantina_ementas       for all to authenticated
  using ((select public.papel()) = 'gestor') with check ((select public.papel()) = 'gestor');
create policy "gestor: escrever" on public.cantina_definicoes    for all to authenticated
  using ((select public.papel()) = 'gestor') with check ((select public.papel()) = 'gestor');
create policy "gestor: escrever" on public.cantina_dias_fechados for all to authenticated
  using ((select public.papel()) = 'gestor') with check ((select public.papel()) = 'gestor');

-- 4. Terminais: marcações (marcar/desmarcar nos dois terminais)
create policy "terminais: escrever" on public.cantina_marcacoes for all to authenticated
  using ((select public.papel()) in ('marcacoes','validacoes')) with check ((select public.papel()) in ('marcacoes','validacoes'));

-- 5. Validações: consumos e visitantes. Apagar só na refeição de hoje (o terminal só mostra a refeição atual);
--    histórico faturado fica intocável a partir do browser.
create policy "validacoes: inserir" on public.cantina_consumos for insert to authenticated
  with check ((select public.papel()) = 'validacoes');
create policy "validacoes: apagar hoje" on public.cantina_consumos for delete to authenticated
  using ((select public.papel()) = 'validacoes'
         and exists (select 1 from public.cantina_ementas e where e.id = ementa_id and e.data = (select public.hoje_lisboa())));
create policy "validacoes: inserir" on public.cantina_visitantes for insert to authenticated
  with check ((select public.papel()) = 'validacoes');
create policy "validacoes: apagar hoje" on public.cantina_visitantes for delete to authenticated
  using ((select public.papel()) = 'validacoes'
         and exists (select 1 from public.cantina_ementas e where e.id = ementa_id and e.data = (select public.hoje_lisboa())));

-- 6. Auditoria de consumos e visitantes (faturação): quem apagou/alterou o quê. utilizador null = sistema (cron).
create table if not exists public.cantina_auditoria (
  id         bigint generated always as identity primary key,
  tabela     text not null,
  operacao   text not null,
  registo    jsonb not null,
  utilizador uuid,
  email      text,
  em         timestamptz not null default now()
);
alter table public.cantina_auditoria enable row level security;
revoke all on public.cantina_auditoria from anon, authenticated;
grant select on public.cantina_auditoria to authenticated;
create policy "gestor: ler" on public.cantina_auditoria for select to authenticated using ((select public.papel()) = 'gestor');

create or replace function public.cantina_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into cantina_auditoria (tabela, operacao, registo, utilizador, email)
  values (tg_table_name, tg_op, to_jsonb(old), auth.uid(), auth.jwt() ->> 'email');
  return old;
end $$;
revoke execute on function public.cantina_auditar() from public, anon, authenticated;

drop trigger if exists cantina_auditar on public.cantina_consumos;
create trigger cantina_auditar after update or delete on public.cantina_consumos
  for each row execute function public.cantina_auditar();
drop trigger if exists cantina_auditar on public.cantina_visitantes;
create trigger cantina_auditar after update or delete on public.cantina_visitantes
  for each row execute function public.cantina_auditar();

commit;
