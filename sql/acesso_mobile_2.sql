-- Acesso mobile — PARTE 2. Correr DEPOIS de publicar o código que já não lê `pin` (fetchFuncionarios usa tem_pin).
-- Irreversível: apaga a coluna pin (texto simples).

begin;

alter table public.cantina_funcionarios drop column if exists pin;

-- pin_hash (e o contador de tentativas) deixa de ser legível pelo anon: só as colunas que a app lê.
-- ponytail: o anon continua a poder ESCREVER pin_hash (o backoffice não tem auth no servidor); fecha-se com Supabase Auth.
revoke select on public.cantina_funcionarios from anon, authenticated;
grant select (id, numero, nome, rfid, foto_url, ativo, created_at, tem_pin, pin_alterado, acesso_mobile)
  on public.cantina_funcionarios to anon, authenticated;

commit;
