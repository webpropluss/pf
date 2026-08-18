-- ============================================================
-- PRIME FIT · Tabla ping (mantener la base despierta)
-- Ejecutar en: SQL Editor → New query → Run
-- Si sale "Potential issues detected", elige "Run without RLS".
-- ============================================================

create table if not exists ping (
  id          int primary key default 1,
  ultima_vez  timestamptz not null default now(),
  visitas     bigint not null default 0,
  constraint ping_una_fila check (id = 1)   -- solo puede existir una fila
);

insert into ping (id) values (1) on conflict (id) do nothing;

-- Lectura pública (a propósito: no guarda datos sensibles)
alter table ping enable row level security;
drop policy if exists ping_lectura_publica on ping;
create policy ping_lectura_publica on ping
  for select to anon, authenticated using (true);

-- Registra el "latido" y cuenta la visita
create or replace function ping_keepalive()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update ping set ultima_vez = now(), visitas = visitas + 1 where id = 1
  returning ultima_vez;
$$;

grant execute on function ping_keepalive() to anon, authenticated;
