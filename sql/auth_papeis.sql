-- Papéis das contas. Correr DEPOIS de criar as contas dos terminais (Authentication → Add user → Auto Confirm).
-- Substituir os dois emails dos gestores. O papel entra no token no próximo login.

update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('papel',
  case email
    when 'marcacoes@graficaideal.pt'  then 'marcacoes'
    when 'validacoes@graficaideal.pt' then 'validacoes'
    else 'gestor'
  end)
where email in ('marcacoes@graficaideal.pt', 'validacoes@graficaideal.pt',
                'GESTOR1@graficaideal.pt', 'GESTOR2@graficaideal.pt');

-- Confirmar: 4 linhas, cada uma com o papel certo
select email, raw_app_meta_data ->> 'papel' as papel from auth.users order by 2, 1;
