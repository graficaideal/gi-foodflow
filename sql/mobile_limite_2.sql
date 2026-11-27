-- Travão global do /mobile: só contam tentativas reais a um PIN. Correr depois do sql/mobile_limite.sql; seguro a qualquer hora.
-- Antes, qualquer anónimo suspendia o login de todos com 20 pedidos/hora usando números inventados
-- ou martelando uma conta já bloqueada (aí o PIN nem é testado).
-- Continua a dar: errado para número inexistente (não revela quais existem).

begin;

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
  if f.id is not null and f.acesso_mobile is not true then return json_build_object('erro','sem_acesso'); end if;

  r := case when f.id is not null then verificar_pin(f.id::text, p_pin) else 'errado' end;
  if r = 'sem_pin' then return json_build_object('erro','sem_acesso'); end if;
  if r <> 'ok' then
    -- f.bloqueado_ate é o valor de antes da tentativa: a que provoca o bloqueio conta, as seguintes não
    if f.id is not null and coalesce(f.bloqueado_ate <= now(), true) then
      insert into cantina_mobile_falhas (numero) values (left(coalesce(p_numero, ''), 10));
      delete from cantina_mobile_falhas where em < now() - interval '30 days';
    end if;
    return json_build_object('erro', case r when 'bloqueado' then r else 'errado' end);
  end if;

  delete from cantina_mobile_sessoes where expira_em < now();
  insert into cantina_mobile_sessoes (funcionario_id) values (f.id) returning token into t;
  return json_build_object('token', t, 'nome', f.nome, 'numero', f.numero, 'pin_alterado', f.pin_alterado);
end $$;

commit;
