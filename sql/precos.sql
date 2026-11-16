-- Preço por refeição com histórico: cada preço vale a partir de `desde` até ao seguinte.
-- Cada consumo (incluindo não consumidos e visitantes) é valorizado com o preço em vigor na data da refeição;
-- mudar o preço nunca altera meses anteriores. Só o gestor lê e altera. Seguro a qualquer hora.

begin;

create table if not exists public.cantina_precos (
  id         bigint generated always as identity primary key,
  desde      date not null unique,
  valor      numeric(8,2) not null check (valor > 0),
  created_at timestamptz not null default now()
);

alter table public.cantina_precos enable row level security;
revoke all on public.cantina_precos from anon;
grant select, insert, update, delete on public.cantina_precos to authenticated;
create policy "gestor: tudo" on public.cantina_precos for all to authenticated
  using ((select public.papel()) = 'gestor') with check ((select public.papel()) = 'gestor');

-- Afeta a faturação: alterações e eliminações ficam na auditoria (mesma função dos consumos)
drop trigger if exists cantina_auditar on public.cantina_precos;
create trigger cantina_auditar after update or delete on public.cantina_precos
  for each row execute function public.cantina_auditar();

commit;
