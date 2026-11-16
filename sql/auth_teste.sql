-- Ensaio do sql/auth_b_fecho.sql SEM EFEITOS: aplica o fecho, faz-se passar por cada conta, testa e desfaz tudo (rollback).
-- Correr o ficheiro todo de uma vez no SQL Editor. Pode correr-se quantas vezes se quiser, a qualquer hora (precisa de ementa hoje).
-- Termina SEMPRE com erro, que é o que desfaz tudo:
--   "OK — todos os testes passaram (nada foi gravado)" = sucesso;  "FALHOU: …" = o teste que falhou.
-- Tudo dentro de um só bloco: com erro o Postgres desfaz sozinho e não fica nenhuma transação aberta a bloquear tabelas.

do $$
declare
  v_ementa public.cantina_ementas.id%type;
  v_func   public.cantina_funcionarios.id%type;
  v_cons   public.cantina_consumos.id%type;
  v_antigo public.cantina_consumos.id%type;
  n int;
  c_gestor constant text := '{"role":"authenticated","email":"teste-gestor","app_metadata":{"papel":"gestor"}}';
  c_marc   constant text := '{"role":"authenticated","email":"marcacoes@graficaideal.pt","app_metadata":{"papel":"marcacoes"}}';
  c_val    constant text := '{"role":"authenticated","email":"validacoes@graficaideal.pt","app_metadata":{"papel":"validacoes"}}';
begin
  -- O fecho, igual ao auth_b_fecho.sql
  drop policy if exists "allow all" on public.cantina_consumos;
  drop policy if exists "allow all" on public.cantina_definicoes;
  drop policy if exists "allow all" on public.cantina_dias_fechados;
  drop policy if exists "allow all" on public.cantina_ementas;
  drop policy if exists "allow all" on public.cantina_funcionarios;
  drop policy if exists "allow all" on public.cantina_marcacoes;
  drop policy if exists "allow all" on public.cantina_visitantes;
  revoke select on public.cantina_funcionarios from anon;
  revoke execute on function public.verificar_pin(text, text) from anon;

  select id into v_ementa from public.cantina_ementas where data = public.hoje_lisboa() limit 1;
  if v_ementa is null then raise exception 'Não há ementa hoje: não dá para testar consumos'; end if;
  select f.id into v_func from public.cantina_funcionarios f
   where f.ativo and not exists (select 1 from public.cantina_consumos c where c.funcionario_id = f.id and c.ementa_id = v_ementa) limit 1;
  if v_func is null then raise exception 'Nenhum funcionário ativo sem consumo hoje: não dá para testar'; end if;
  select c.id into v_antigo from public.cantina_consumos c join public.cantina_ementas e on e.id = c.ementa_id
   where e.data < public.hoje_lisboa() limit 1;

  -- 1. Gestor não regista consumos
  perform set_config('request.jwt.claims', c_gestor, true); perform set_config('role', 'authenticated', true);
  begin
    insert into public.cantina_consumos (funcionario_id, ementa_id, prato_num) values (v_func, v_ementa, 1);
    raise exception 'FALHOU: o gestor registou um consumo';
  exception when insufficient_privilege then null;
  end;

  -- 2. Validações regista um consumo de hoje
  perform set_config('request.jwt.claims', c_val, true);
  insert into public.cantina_consumos (funcionario_id, ementa_id, prato_num) values (v_func, v_ementa, 1) returning id into v_cons;

  -- 3. Gestor e marcações não o apagam
  perform set_config('request.jwt.claims', c_gestor, true);
  delete from public.cantina_consumos where id = v_cons; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: o gestor apagou um consumo'; end if;
  perform set_config('request.jwt.claims', c_marc, true);
  delete from public.cantina_consumos where id = v_cons; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: o terminal de marcações apagou um consumo'; end if;

  -- 4. Validações apaga o de hoje, mas não os de dias anteriores (faturados)
  perform set_config('request.jwt.claims', c_val, true);
  delete from public.cantina_consumos where id = v_cons; get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: validações não conseguiu apagar o consumo de hoje'; end if;
  if v_antigo is not null then
    delete from public.cantina_consumos where id = v_antigo; get diagnostics n = row_count;
    if n <> 0 then raise exception 'FALHOU: validações apagou um consumo de um dia anterior'; end if;
  end if;

  -- 5. Terminais leem funcionários
  perform set_config('request.jwt.claims', c_marc, true);
  select count(*) into n from public.cantina_funcionarios;
  if n = 0 then raise exception 'FALHOU: o terminal de marcações não lê funcionários'; end if;

  -- 6. Anon (/mobile, sem conta): lê ementas e usa as funções do mobile; nada mais
  perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('role', 'anon', true);
  select count(*) into n from public.cantina_ementas;
  if n = 0 then raise exception 'FALHOU: o anon (/mobile) não lê ementas'; end if;
  perform public.mobile_login('999', '0000');
  begin
    perform 1 from public.cantina_funcionarios limit 1;
    raise exception 'FALHOU: o anon lê funcionários';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.cantina_consumos (funcionario_id, ementa_id, prato_num) values (v_func, v_ementa, 1);
    raise exception 'FALHOU: o anon registou um consumo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.verificar_pin('1', '0000');
    raise exception 'FALHOU: o anon ainda chama verificar_pin';
  exception when insufficient_privilege then null;
  end;

  -- 7. O apagar ficou na auditoria com o email de quem apagou
  reset role;
  select count(*) into n from public.cantina_auditoria
   where operacao = 'DELETE' and registo ->> 'id' = v_cons::text and email = 'validacoes@graficaideal.pt';
  if n <> 1 then raise exception 'FALHOU: o consumo apagado não ficou na auditoria'; end if;

  -- Tudo certo. Este erro é de propósito: desfaz tudo o que o ensaio fez.
  raise exception 'OK — todos os testes passaram (nada foi gravado)';
end $$;
