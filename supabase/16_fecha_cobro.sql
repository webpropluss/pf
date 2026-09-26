-- ============================================================
-- PRIME FIT · Paso 16 · Fecha del cobro en la inscripción
--
-- Hasta ahora el pago se guardaba siempre con la fecha del día en
-- que lo cargabas al sistema. Si inscribías el 25 a alguien que
-- empezó el 19, el dinero aparecía el 25.
--
-- Ahora la inscripción puede decir en qué día entró el dinero.
-- El formulario manda por defecto la fecha de inicio, y la puedes
-- cambiar si cobraste otro día.
--
-- Es seguro ejecutarlo varias veces.
-- ============================================================

-- La función cambia de firma (un parámetro más), así que primero se
-- quita la anterior. Si no, quedarían dos versiones y la app no
-- sabría a cuál llamar.
drop function if exists crear_inscripcion(
  bigint, date, date, numeric, text, text, jsonb, numeric);

create or replace function crear_inscripcion(
  p_alumno_id      bigint,
  p_fecha_inicio   date,
  p_fecha_fin      date,
  p_descuento      numeric,
  p_metodo_pago    text,
  p_usuario_nombre text,
  p_detalles       jsonb,
  p_pago_inicial   numeric default 0,  -- lo que paga en el momento
  p_fecha_pago     date default null   -- día en que entró el dinero; null = hoy
) returns bigint
language plpgsql security definer as $$
declare
  v_id       bigint;
  v_numero   int;
  v_subtotal numeric := 0;
  v_total    numeric := 0;
  v_cobro    numeric := 0;
  v_det      jsonb;
  v_horario  horarios%rowtype;
  v_precio   numeric;
  v_lista    numeric;
begin
  if jsonb_array_length(p_detalles) = 0 then
    raise exception 'La inscripción debe tener al menos una disciplina.';
  end if;

  select coalesce(max(numero), 0) + 1 into v_numero
  from inscripciones where fecha::date = current_date;

  for v_det in select * from jsonb_array_elements(p_detalles) loop
    v_subtotal := v_subtotal + (v_det->>'precio_mensual')::numeric * (v_det->>'meses')::int;
  end loop;

  v_total := greatest(v_subtotal - coalesce(p_descuento, 0), 0);

  insert into inscripciones (numero, alumno_id, fecha_inicio, fecha_fin,
                             subtotal, descuento, total, metodo_pago, usuario_nombre)
  values (v_numero, p_alumno_id, p_fecha_inicio, p_fecha_fin,
          v_subtotal, coalesce(p_descuento, 0), v_total,
          p_metodo_pago, p_usuario_nombre)
  returning id into v_id;

  for v_det in select * from jsonb_array_elements(p_detalles) loop
    select * into v_horario from horarios
    where id = (v_det->>'horario_id')::bigint for update;

    if v_horario.id is null then
      raise exception 'El horario no existe.';
    end if;
    if v_horario.inscritos >= v_horario.cupo then
      raise exception 'La clase % está llena.', v_horario.id;
    end if;

    -- No inscribir dos veces en el mismo horario mientras siga vigente.
    -- Las anuladas no cuentan: por eso, si alguien se va y vuelve, se
    -- anula la anterior y se le puede hacer una nueva.
    if exists (
      select 1
      from inscripcion_detalles d
      join inscripciones i on i.id = d.inscripcion_id
      where d.horario_id = v_horario.id
        and i.alumno_id = p_alumno_id
        and i.anulada = false
        and i.fecha_fin >= current_date
    ) then
      raise exception 'El alumno ya tiene una inscripción vigente en ese horario. Anúlala primero (🚫) si volvió con fechas nuevas.';
    end if;

    v_precio := (v_det->>'precio_mensual')::numeric;
    v_lista  := coalesce((v_det->>'precio_lista')::numeric, v_precio);

    insert into inscripcion_detalles
      (inscripcion_id, disciplina_id, horario_id, precio_mensual, precio_lista, meses)
    values (v_id, (v_det->>'disciplina_id')::bigint, v_horario.id,
            v_precio, v_lista, (v_det->>'meses')::int);

    update horarios set inscritos = inscritos + 1 where id = v_horario.id;

    insert into movimientos_cupo (horario_id, tipo, cantidad, inscritos_resultante, motivo, referencia)
    values (v_horario.id, 'inscripcion', 1, v_horario.inscritos + 1,
            case when v_lista > v_precio
                 then 'Inscripción con precio especial'
                 else 'Inscripción de alumno' end,
            'INS-' || v_id);
  end loop;

  -- ---- El cobro, en el mismo acto ----
  v_cobro := least(coalesce(p_pago_inicial, 0), v_total);
  if v_cobro > 0 then
    insert into pagos (inscripcion_id, alumno_id, monto, metodo, concepto,
                       usuario_nombre, fecha)
    values (v_id, p_alumno_id, v_cobro, coalesce(p_metodo_pago, 'Efectivo'),
            'Mensualidad', coalesce(p_usuario_nombre, ''),
            -- si mandan fecha, se guarda ese día a mediodía (evita que el
            -- huso horario lo corra al día anterior); si no, el momento exacto
            case when p_fecha_pago is null then now()
                 else p_fecha_pago::timestamp + interval '12 hours' end);
  end if;

  return v_id;
end $$;

-- ------------------------------------------------------------
-- OPCIONAL · Corregir las inscripciones que ya cargaste
--
-- Si ya registraste inscripciones con fecha de inicio anterior
-- (por ejemplo las que empiezan el 19 y cargaste el 25), esto
-- mueve su cobro al día en que empezó la mensualidad.
--
-- 1º MIRA qué se cambiaría (esto no toca nada):
-- ------------------------------------------------------------
select p.id as pago_id, a.nombre as alumno, p.monto,
       p.fecha::date as cobro_ahora,
       i.fecha_inicio as pasaria_a
from pagos p
join inscripciones i on i.id = p.inscripcion_id
join alumnos a       on a.id = p.alumno_id
where p.fecha::date <> i.fecha_inicio
order by p.id;

-- ------------------------------------------------------------
-- 2º Si la lista de arriba es la que esperabas, quita los dos
--    guiones de las tres líneas siguientes y vuelve a ejecutar.
--    Si la lista salió vacía, no hay nada que corregir.
-- ------------------------------------------------------------
-- update pagos p
--    set fecha = i.fecha_inicio::timestamp + interval '12 hours'
--   from inscripciones i
--  where i.id = p.inscripcion_id and p.fecha::date <> i.fecha_inicio;
