-- Papéis das contas. Correr DEPOIS de criar as contas dos terminais. Seguro durante o serviço: só o código novo lê o papel.
-- Correr um passo de cada vez no SQL Editor.

-- PASSO 1 — ver que contas existem (para saber os emails dos dois gestores)
select email from auth.users order by email;

-- PASSO 2 — terminais (emails já certos)
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"papel":"marcacoes"}'
 where email = 'marcacoes@graficaideal.pt';
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"papel":"validacoes"}'
 where email = 'validacoes@graficaideal.pt';

-- PASSO 3 — gestores: trocar os dois emails abaixo pelos reais que apareceram no passo 1
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"papel":"gestor"}'
 where email in ('sergiohenriques@graficaideal.pt', 'sofialacerda@graficaideal.pt');

-- PASSO 4 — confirmar: as 4 contas com papel preenchido (as outras, se houver, ficam sem papel = sem acesso)
select email, raw_app_meta_data ->> 'papel' as papel from auth.users order by papel nulls last, email;
