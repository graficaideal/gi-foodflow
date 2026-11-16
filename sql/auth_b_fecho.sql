-- Autenticação — PARTE B. Correr DEPOIS do deploy e de os dois terminais e os gestores terem feito login.
-- Tira ao anon tudo exceto: ler ementas/definições/dias encerrados e as funções do /mobile.

begin;

drop policy if exists "allow all" on public.cantina_consumos;
drop policy if exists "allow all" on public.cantina_definicoes;
drop policy if exists "allow all" on public.cantina_dias_fechados;
drop policy if exists "allow all" on public.cantina_ementas;
drop policy if exists "allow all" on public.cantina_funcionarios;
drop policy if exists "allow all" on public.cantina_marcacoes;
drop policy if exists "allow all" on public.cantina_visitantes;

-- Colunas de funcionários deixam de ser legíveis pelo anon (RLS já bloqueia; isto é a segunda tranca)
revoke select on public.cantina_funcionarios from anon;

-- PIN do quiosque só a partir dos terminais (o /mobile usa mobile_login, que tem bloqueio)
revoke execute on function public.verificar_pin(text, text) from anon;

-- O backoffice já não usa PIN
delete from public.cantina_definicoes where chave = 'backoffice_pin';

commit;

-- Se algo partir, repor o acesso anterior (temporário!) tabela a tabela:
--   create policy "allow all" on public.cantina_<tabela> for all using (true) with check (true);
