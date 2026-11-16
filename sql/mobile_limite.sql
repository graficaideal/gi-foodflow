-- Limite de tentativas de PIN no /mobile. Seguro a qualquer hora; o frontend antigo mostra "PIN incorreto" para o erro novo.
-- A. Acesso mobile verificado ANTES do PIN: quem não tem acesso não pode ser atacado por aqui nem fica bloqueado no quiosque.
-- B. Travão global: 20 PINs errados na última hora (todos os funcionários) suspendem o login mobile.
--    Sessões já abertas e o quiosque continuam a funcionar.

begin;

-- Falhas de login mobile (também serve para ver se houve ataque: select * from cantina_mobile_falhas order by em desc)
create table if not exists public.cantina_mobile_falhas (
  id     bigint generated always as identity primary key,
  numero text not null,
  em     timestamptz not null default now()
);
create index if not exists cantina_mobile_falhas_em on public.cantina_mobile_falhas (em);
alter table public.cantina_mobile_falhas enable row level security;
revoke all on public.cantina_mobile_falhas from anon, authenticated;

-- {token, nome, numero, pin_alterado} ou {erro: errado|bloqueado|sem_acesso|suspenso}
create or replace function public.mobile_login(p_numero text, p_pin text) returns json
language plpgsql security definer set search_path = public as $$
declare f cantina_funcionarios; r text; t uuid;
begin
  -- ponytail: janela deslizante de 1h, contar e inserir sem lock deixa passar 1-2 a mais em pedidos simultâneos
  if (select count(*) from cantina_mobile_falhas where em > now() - interval '1 hour') >= 20 then
    return json_build_object('erro','suspenso');
  end if;

  select * into f from cantina_funcionarios
   where ativo and ltrim(numero::text, '0') = ltrim(trim(p_numero), '0') limit 1;
  if found and f.acesso_mobile is not true then return json_build_object('erro','sem_acesso'); end if;

  r := case when found then verificar_pin(f.id::text, p_pin) else 'errado' end;
  if r = 'sem_pin' then return json_build_object('erro','sem_acesso'); end if;
  if r <> 'ok' then
    insert into cantina_mobile_falhas (numero) values (left(coalesce(p_numero, ''), 10));
    delete from cantina_mobile_falhas where em < now() - interval '30 days';
    return json_build_object('erro', case r when 'bloqueado' then r else 'errado' end);
  end if;

  delete from cantina_mobile_sessoes where expira_em < now();
  insert into cantina_mobile_sessoes (funcionario_id) values (f.id) returning token into t;
  return json_build_object('token', t, 'nome', f.nome, 'numero', f.numero, 'pin_alterado', f.pin_alterado);
end $$;

commit;
