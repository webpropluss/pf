-- ============================================================
-- PRIME FIT · Actualización para el módulo Usuarios
-- Ejecutar en el SQL Editor (una sola vez)
-- ============================================================

-- Permite al administrador asignar rol a una cuenta ya creada en
-- Authentication → Users, buscándola por su email.
create or replace function id_usuario_por_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;

-- Solo usuarios autenticados pueden llamarla
revoke all on function id_usuario_por_email(text) from public;
grant execute on function id_usuario_por_email(text) to authenticated;
