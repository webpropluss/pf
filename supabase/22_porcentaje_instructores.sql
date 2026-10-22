-- ============================================================
-- PRIME FIT · Paso 22 · Porcentaje de cada instructor
--
-- Cada instructor se lleva un porcentaje de lo que se cobra por
-- sus clases (inscripciones y pases del día de sus horarios).
-- Ej.: 50 → la mitad para el instructor y la mitad para Prime Fit.
--
-- Ejecutar en: SQL Editor → New query → Run
-- Es seguro ejecutarlo varias veces.
-- ============================================================

alter table instructores
  add column if not exists porcentaje numeric(5,2) not null default 0;

alter table instructores drop constraint if exists instructores_porcentaje_valido;
alter table instructores add constraint instructores_porcentaje_valido
  check (porcentaje >= 0 and porcentaje <= 100);

comment on column instructores.porcentaje is
  'Porcentaje de lo cobrado por sus clases que le corresponde al instructor (0 a 100).';

-- Comprobación
select codigo, nombre, porcentaje from instructores order by codigo;
