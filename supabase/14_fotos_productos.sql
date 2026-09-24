-- ============================================================
-- PRIME FIT · Fotos de los productos
-- Ejecutar en: SQL Editor → New query → Run
--
-- Las fotos se guardan en Supabase Storage, no en la base de datos.
-- El sistema las achica y comprime EN EL TELÉFONO antes de subirlas,
-- así una foto de 3 MB llega pesando unos 40 KB.
-- ============================================================

alter table productos add column if not exists foto_url text;

-- ------------------------------------------------------------
-- Depósito de las fotos (público para poder mostrarlas)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fotos-productos', 'fotos-productos', true)
on conflict (id) do nothing;

drop policy if exists "productos_foto_lectura" on storage.objects;
create policy "productos_foto_lectura" on storage.objects
  for select using (bucket_id = 'fotos-productos');

drop policy if exists "productos_foto_subir" on storage.objects;
create policy "productos_foto_subir" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos-productos');

drop policy if exists "productos_foto_borrar" on storage.objects;
create policy "productos_foto_borrar" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos-productos');

drop policy if exists "productos_foto_reemplazar" on storage.objects;
create policy "productos_foto_reemplazar" on storage.objects
  for update to authenticated using (bucket_id = 'fotos-productos');
