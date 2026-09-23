-- Opcional: quitar la columna email de la tabla alumnos en Supabase --
-- (No es obligatorio: si la dejas, simplemente queda vacía y no molesta.)
alter table alumnos drop column if exists email;
