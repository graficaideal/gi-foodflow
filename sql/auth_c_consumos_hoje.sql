-- Autenticação — PARTE C. Validações só regista consumos/visitantes da ementa de HOJE (como já acontecia ao apagar).
-- Dias anteriores (já faturados) ficam intocáveis a partir do browser. O fecho automático (fechar_refeicoes) não é afetado:
-- é security definer do dono da tabela, que não passa pelas políticas.
-- Seguro a qualquer hora: o terminal só regista na refeição atual.

begin;

drop policy "validacoes: inserir" on public.cantina_consumos;
create policy "validacoes: inserir hoje" on public.cantina_consumos for insert to authenticated
  with check ((select public.papel()) = 'validacoes'
              and exists (select 1 from public.cantina_ementas e where e.id = ementa_id and e.data = (select public.hoje_lisboa())));

drop policy "validacoes: inserir" on public.cantina_visitantes;
create policy "validacoes: inserir hoje" on public.cantina_visitantes for insert to authenticated
  with check ((select public.papel()) = 'validacoes'
              and exists (select 1 from public.cantina_ementas e where e.id = ementa_id and e.data = (select public.hoje_lisboa())));

commit;
