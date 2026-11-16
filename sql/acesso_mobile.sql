-- Acesso mobile + PIN único (quiosque e /mobile), verificado no servidor.
-- PARTE 1 — aditiva, o código atual continua a funcionar. Correr no SQL Editor do Supabase ANTES de publicar.
-- Depois do deploy: sql/acesso_mobile_2.sql (fecha a leitura de pin_hash e apaga a coluna pin).

begin;

-- 0. O pgcrypto valida hashes do bcryptjs. O cliente grava $2a$ (utils/pin.js); se isto falhar, não continuar.
do $$ begin
  assert extensions.crypt('1234', '$2a$10$oto6U/fz8JHf7SnTb0YrKurb832jO6CUEtbLXeO3Q/v0or5MiwNhi')
       = '$2a$10$oto6U/fz8JHf7SnTb0YrKurb832jO6CUEtbLXeO3Q/v0or5MiwNhi', 'pgcrypto não reconhece hashes do bcryptjs';
end $$;

-- 1. Bloqueio por tentativas; tem_pin diz ao quiosque se pede PIN sem expor o hash
alter table public.cantina_funcionarios
  add column if not exists tentativas_falhadas integer not null default 0,
  add column if not exists bloqueado_ate timestamptz,
  add column if not exists tem_pin boolean generated always as (pin_hash is not null) stored;

-- 2. PINs atuais (texto) → hash. Os restantes estão vazios ('').
update public.cantina_funcionarios
   set pin_hash = extensions.crypt(pin, extensions.gen_salt('bf', 10)), pin_alterado = false
 where pin ~ '^\d{4}$' and pin_hash is null;

-- 3. Sessões mobile: token opaco no sessionStorage do telemóvel. Sem políticas RLS → só as funções lhe tocam.
--    ponytail: tipo do id lido do catálogo para a FK bater certo, seja uuid ou bigint
do $$ begin
  execute format($f$
    create table if not exists public.cantina_mobile_sessoes (
      token          uuid primary key default gen_random_uuid(),
      funcionario_id %s not null references public.cantina_funcionarios(id) on delete cascade,
      expira_em      timestamptz not null default now() + interval '12 hours'
    )$f$,
    (select format_type(atttypid, atttypmod) from pg_attribute
      where attrelid = 'public.cantina_funcionarios'::regclass and attname = 'id'));
end $$;
alter table public.cantina_mobile_sessoes enable row level security;
revoke all on public.cantina_mobile_sessoes from anon, authenticated;

-- 4. PIN mudou: limpa o bloqueio. Reset do backoffice (pin_alterado = false) termina as sessões abertas.
create or replace function public.cantina_pin_mudou() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.tentativas_falhadas := 0;
  new.bloqueado_ate := null;
  if not new.pin_alterado then delete from cantina_mobile_sessoes where funcionario_id = new.id; end if;
  return new;
end $$;
drop trigger if exists cantina_pin_mudou on public.cantina_funcionarios;
create trigger cantina_pin_mudou before update of pin_hash on public.cantina_funcionarios
  for each row when (new.pin_hash is distinct from old.pin_hash) execute function public.cantina_pin_mudou();

-- 5. Helpers internos (não expostos ao anon)
create or replace function public._cantina_def(p_chave text, p_omissao text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select trim(both '"' from valor::text) from cantina_definicoes where chave = p_chave), p_omissao)
$$;

create or replace function public._mobile_sessao(p_token uuid, p_exige_pin_alterado boolean default true)
returns public.cantina_funcionarios
language plpgsql security definer set search_path = public as $$
declare f cantina_funcionarios;
begin
  select fu.* into f from cantina_mobile_sessoes s join cantina_funcionarios fu on fu.id = s.funcionario_id
   where s.token = p_token and s.expira_em > now() and fu.ativo and fu.acesso_mobile;
  if not found then raise exception 'sessao_invalida'; end if;
  if p_exige_pin_alterado and not f.pin_alterado then raise exception 'pin_por_alterar'; end if;
  return f;
end $$;

-- Mesmas regras do terminal: dia passado/encerrado não; hoje bloqueado se bloquear_dia_proprio, senão até ao fim da refeição.
create or replace function public._mobile_ementa_aberta(p_ementa_id text) returns public.cantina_ementas
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
    if agora::time > (case e.tipo when 'A' then _cantina_def('almoco_fim','14:30') else _cantina_def('jantar_fim','21:30') end)::time
      then raise exception 'terminou'; end if;
  end if;
  return e;
end $$;

-- 6. API pública
-- Quiosque e mobile partilham o contador: 5 falhas → 15 min bloqueado.
create or replace function public.verificar_pin(p_funcionario_id text, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare f cantina_funcionarios;
begin
  select * into f from cantina_funcionarios where id::text = p_funcionario_id for update;
  if not found or not f.ativo then return 'errado'; end if;
  if f.pin_hash is null then return 'sem_pin'; end if;
  if f.bloqueado_ate > now() then return 'bloqueado'; end if;
  if crypt(p_pin, f.pin_hash) = f.pin_hash then
    update cantina_funcionarios set tentativas_falhadas = 0 where id = f.id;
    return 'ok';
  end if;
  if f.tentativas_falhadas + 1 >= 5 then
    update cantina_funcionarios set tentativas_falhadas = 0, bloqueado_ate = now() + interval '15 minutes' where id = f.id;
    return 'bloqueado';
  end if;
  update cantina_funcionarios set tentativas_falhadas = f.tentativas_falhadas + 1 where id = f.id;
  return 'errado';
end $$;

-- {token, nome, numero, pin_alterado} ou {erro: errado|bloqueado|sem_acesso}
create or replace function public.mobile_login(p_numero text, p_pin text) returns json
language plpgsql security definer set search_path = public as $$
declare f cantina_funcionarios; r text; t uuid;
begin
  select * into f from cantina_funcionarios
   where ativo and ltrim(numero::text, '0') = ltrim(trim(p_numero), '0') limit 1;
  if not found then return json_build_object('erro','errado'); end if;
  r := verificar_pin(f.id::text, p_pin);
  if r <> 'ok' then return json_build_object('erro', case r when 'bloqueado' then r else 'errado' end); end if;
  if not f.acesso_mobile then return json_build_object('erro','sem_acesso'); end if;
  delete from cantina_mobile_sessoes where expira_em < now();
  insert into cantina_mobile_sessoes (funcionario_id) values (f.id) returning token into t;
  return json_build_object('token', t, 'nome', f.nome, 'numero', f.numero, 'pin_alterado', f.pin_alterado);
end $$;

-- Recebe o hash (bcryptjs no cliente); as regras do PIN novo são validadas no cliente (utils/pin.js).
create or replace function public.mobile_alterar_pin(p_token uuid, p_pin_hash text) returns void
language plpgsql security definer set search_path = public as $$
declare f cantina_funcionarios := _mobile_sessao(p_token, false);
begin
  if p_pin_hash !~ '^\$2a\$\d\d\$[./A-Za-z0-9]{53}$' then raise exception 'hash_invalido'; end if;
  update cantina_funcionarios set pin_hash = p_pin_hash, pin_alterado = true where id = f.id;
end $$;

-- Marcações do próprio a partir de hoje: [{ementa_id, prato_num}]
create or replace function public.mobile_marcacoes(p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
declare f cantina_funcionarios := _mobile_sessao(p_token);
begin
  return coalesce((
    select json_agg(json_build_object('ementa_id', m.ementa_id, 'prato_num', m.prato_num))
      from cantina_marcacoes m join cantina_ementas e on e.id = m.ementa_id
     where m.funcionario_id = f.id and e.data >= (now() at time zone 'Europe/Lisbon')::date
  ), '[]'::json);
end $$;

create or replace function public.mobile_marcar(p_token uuid, p_ementa_id text, p_prato_num integer) returns void
language plpgsql security definer set search_path = public as $$
declare
  f cantina_funcionarios := _mobile_sessao(p_token);
  e cantina_ementas      := _mobile_ementa_aberta(p_ementa_id);
begin
  if p_prato_num not between 1 and 4 or (to_jsonb(e) ->> ('prato' || p_prato_num || '_label')) is null
    then raise exception 'prato_invalido'; end if;
  if exists (select 1 from cantina_consumos where funcionario_id = f.id and ementa_id = e.id) then raise exception 'consumido'; end if;
  insert into cantina_marcacoes (funcionario_id, ementa_id, prato_num) values (f.id, e.id, p_prato_num)
  on conflict (funcionario_id, ementa_id) do update set prato_num = excluded.prato_num;
end $$;

create or replace function public.mobile_desmarcar(p_token uuid, p_ementa_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  f cantina_funcionarios := _mobile_sessao(p_token);
  e cantina_ementas      := _mobile_ementa_aberta(p_ementa_id);
begin
  if exists (select 1 from cantina_consumos where funcionario_id = f.id and ementa_id = e.id) then raise exception 'consumido'; end if;
  delete from cantina_marcacoes where funcionario_id = f.id and ementa_id = e.id;
end $$;

-- 7. Permissões: o Supabase dá execute ao anon por omissão em funções novas
revoke execute on function public.cantina_pin_mudou(), public._cantina_def(text,text), public._mobile_sessao(uuid,boolean),
  public._mobile_ementa_aberta(text) from public, anon, authenticated;
revoke execute on function public.verificar_pin(text,text), public.mobile_login(text,text), public.mobile_alterar_pin(uuid,text),
  public.mobile_marcacoes(uuid), public.mobile_marcar(uuid,text,integer), public.mobile_desmarcar(uuid,text) from public;
grant execute on function public.verificar_pin(text,text), public.mobile_login(text,text), public.mobile_alterar_pin(uuid,text),
  public.mobile_marcacoes(uuid), public.mobile_marcar(uuid,text,integer), public.mobile_desmarcar(uuid,text) to anon, authenticated;

commit;
