-- ============================================================
-- PRIME FIT · Paso 20 · Pase del día: disciplina, horario y cantidad
--
-- ⚠ ESTE ARCHIVO REEMPLAZA AL 19. Si todavía no ejecutaste el 19,
--   NO lo ejecutes: corre solo este, que hace todo lo del 19 y más.
--   Si ya corriste el 19, ejecuta este igual: lo completa.
--
-- Qué deja listo:
--   • El pase no necesita alumno (ya no se pide el nombre).
--   • Guarda la DISCIPLINA y su HORARIO. Con el horario se sabe
--     qué instructor dio esa clase, y los pases pueden aparecer
--     en el filtro por instructor de Reportes.
--   • Se pueden registrar VARIOS pases de una vez: si llegan 5
--     juntos, se crean 5 pases del mismo precio, no uno de 5×.
--     Todo en una sola operación: o entran los 5, o no entra ninguno.
--
-- Ejecutar en: SQL Editor → New query → Run
-- Si sale "Potential issues detected", elige "Run and enable RLS".
-- Es seguro ejecutarlo varias veces.
-- ============================================================

-- 1) El pase ya no exige una persona
alter table pases_dia alter column alumno_id drop not null;

-- 2) Guarda la disciplina. (horario_id ya existía desde el principio.)
alter table pases_dia
  add column if not exists disciplina_id bigint references disciplinas(id) on delete set null;

-- 3) Los dos montos que aparecen como botones
--    El 25 era el valor viejo por defecto: si sigue ahí, pasa a 10.
--    Si ya lo cambiaste a otra cosa, se respeta.
update config set valor = '10' where clave = 'precio_pase_dia' and valor = '25';
insert into config (clave, valor) values ('precio_pase_dia', '10')
  on conflict (clave) do nothing;
insert into config (clave, valor) values ('precio_pase_dia_2', '15')
  on conflict (clave) do nothing;

-- ============================================================
-- 4) REGISTRAR UNO O VARIOS PASES
--
--    Se quitan las dos versiones anteriores de la función: la
--    original (pedía alumno y observación) y la del paso 19 (sin
--    horario ni cantidad). Si quedaran varias, la app no sabría
--    a cuál llamar.
-- ============================================================

drop function if exists crear_pase_dia(bigint, date, bigint, numeric, text, text, text);
drop function if exists crear_pase_dia(date, bigint, numeric, text, text);

create or replace function crear_pase_dia(
  p_fecha          date,
  p_disciplina_id  bigint,
  p_horario_id     bigint default null,
  p_monto          numeric default 0,
  p_metodo_pago    text    default 'Efectivo',
  p_usuario_nombre text    default '',
  p_cantidad       int     default 1
) returns int
language plpgsql security definer as $$
declare
  v_id       bigint;
  v_fecha    date;
  v_cantidad int;
  v_momento  timestamptz;
  v_hor      horarios%rowtype;
  i          int;
begin
  v_fecha    := coalesce(p_fecha, current_date);
  v_cantidad := coalesce(p_cantidad, 1);

  if p_monto is null or p_monto < 0 then
    raise exception 'El monto del pase no es válido.';
  end if;
  if v_cantidad < 1 or v_cantidad > 50 then
    raise exception 'La cantidad de pases debe estar entre 1 y 50.';
  end if;

  -- Si mandan horario, tiene que ser de la disciplina elegida: así no
  -- se le atribuye a un instructor una clase que no dio.
  if p_horario_id is not null then
    select * into v_hor from horarios where id = p_horario_id;
    if v_hor.id is null then
      raise exception 'El horario no existe.';
    end if;
    if p_disciplina_id is not null and v_hor.disciplina_id <> p_disciplina_id then
      raise exception 'Ese horario no es de la disciplina elegida.';
    end if;
  end if;

  -- El cobro lleva la hora real si es de hoy; si es de otro día, mediodía
  -- (evita que el huso horario lo corra al día anterior).
  v_momento := case when v_fecha = current_date
                    then now()
                    else v_fecha + time '12:00' end;

  for i in 1..v_cantidad loop
    insert into pases_dia (fecha, disciplina_id, horario_id, monto, metodo_pago, usuario_nombre)
    values (v_fecha, p_disciplina_id, p_horario_id, p_monto,
            coalesce(p_metodo_pago, 'Efectivo'), coalesce(p_usuario_nombre, ''))
    returning id into v_id;

    -- Cada pase genera su propio cobro, para que sume en Dashboard y Reportes
    if p_monto > 0 then
      insert into pagos (fecha, pase_dia_id, alumno_id, monto, metodo, concepto, usuario_nombre)
      values (v_momento, v_id, null, p_monto, coalesce(p_metodo_pago, 'Efectivo'),
              'Pase del día', coalesce(p_usuario_nombre, ''));
    end if;
  end loop;

  return v_cantidad;   -- cuántos quedaron registrados
end $$;

-- ------------------------------------------------------------
-- Comprobación
-- ------------------------------------------------------------
select
  (select count(*) from pg_proc where proname = 'crear_pase_dia')      as versiones_de_la_funcion,
  (select is_nullable from information_schema.columns
    where table_name = 'pases_dia' and column_name = 'alumno_id')      as alumno_opcional,
  (select count(*) from information_schema.columns
    where table_name = 'pases_dia' and column_name = 'disciplina_id')  as tiene_disciplina,
  (select count(*) from information_schema.columns
    where table_name = 'pases_dia' and column_name = 'horario_id')     as tiene_horario,
  (select valor from config where clave = 'precio_pase_dia')           as monto_1,
  (select valor from config where clave = 'precio_pase_dia_2')         as monto_2;
