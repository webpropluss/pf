-- ============================================================
-- PRIME FIT · Normalizar los teléfonos ya cargados
-- Ejecutar en: SQL Editor → New query → Run
--
-- Deja todos los números en el formato que necesita WhatsApp:
--   591 + los 8 dígitos del celular   →   59171234567
--
-- Es seguro ejecutarlo varias veces: los que ya están bien no se tocan.
-- ============================================================

-- 1) Quitar espacios, guiones, paréntesis y el signo +
update alumnos
   set telefono = regexp_replace(telefono, '\D', '', 'g')
 where telefono is not null
   and telefono ~ '\D';

update instructores
   set telefono = regexp_replace(telefono, '\D', '', 'g')
 where telefono is not null
   and telefono ~ '\D';

-- 2) A los que quedaron con solo 8 dígitos, agregarles el 591
update alumnos
   set telefono = '591' || telefono
 where length(coalesce(telefono, '')) = 8;

update instructores
   set telefono = '591' || telefono
 where length(coalesce(telefono, '')) = 8;

-- ============================================================
-- 3) Revisión: números que quedaron raros y conviene corregir a mano
--    (lo normal es 11 dígitos: 591 + 8)
-- ============================================================
select id, codigo, nombre, telefono, length(telefono) as digitos,
       case
         when coalesce(telefono,'') = ''        then 'sin teléfono'
         when length(telefono) = 11
          and telefono like '591%'              then 'correcto'
         else                                        'revisar a mano'
       end as estado
  from alumnos
 where coalesce(telefono,'') = ''
    or length(telefono) <> 11
    or telefono not like '591%'
 order by nombre;
