-- ============================================================
-- PRIME FIT · Precio especial (descuento) por disciplina
-- Ejecutar en: SQL Editor → New query → Run
-- Si sale "Potential issues detected", elige "Run and enable RLS".
--
-- Qué hace:
--   Guarda DOS precios en cada línea de la inscripción:
--     precio_mensual → lo que realmente se le cobra al alumno
--     precio_lista   → el precio normal de la disciplina
--   Así queda registrado cuánto descuento se le hizo (ej. promoción
--   de inauguración: normal 150, se le cobra 130).
-- ============================================================

-- 1) Columna nueva. Las inscripciones viejas quedan sin descuento.
alter table inscripcion_detalles
  add column if not exists precio_lista numeric(10,2);

update inscripcion_detalles
   set precio_lista = precio_mensual
 where precio_lista is null;

-- 2) La función de inscripción ahora acepta el precio especial.
--    Mantiene la misma firma: no hay que tocar nada más.
create or replace function crear_inscripcion(
  p_alumno_id      bigint,
  p_fecha_inicio   date,
  p_fecha_fin      date,
  p_descuento      numeric,
  p_metodo_pago    text,
  p_usuario_nombre text,
  p_detalles       jsonb   -- [{"disciplina_id":1,"horario_id":2,"precio_mensual":130,"precio_lista":150,"meses":1}, ...]
) returns bigint
language plpgsql security definer as $$
declare
  v_id       bigint;
  v_numero   int;
  v_subtotal numeric := 0;
  v_det      jsonb;
  v_horario  horarios%rowtype;
  v_precio   numeric;
  v_lista    numeric;
begin
  if jsonb_array_length(p_detalles) = 0 then
    raise exception 'La inscripción debe tener al menos una disciplina.';
  end if;

  -- correlativo del día
  select coalesce(max(numero), 0) + 1 into v_numero
  from inscripciones where fecha::date = current_date;

  -- subtotal con los precios que realmente se cobran
  for v_det in select * from jsonb_array_elements(p_detalles) loop
    v_subtotal := v_subtotal + (v_det->>'precio_mensual')::numeric * (v_det->>'meses')::int;
  end loop;

  insert into inscripciones (numero, alumno_id, fecha_inicio, fecha_fin,
                             subtotal, descuento, total, metodo_pago, usuario_nombre)
  values (v_numero, p_alumno_id, p_fecha_inicio, p_fecha_fin,
          v_subtotal, coalesce(p_descuento,0),
          greatest(v_subtotal - coalesce(p_descuento,0), 0),
          p_metodo_pago, p_usuario_nombre)
  returning id into v_id;

  for v_det in select * from jsonb_array_elements(p_detalles) loop
    -- bloquear el horario para validar el cupo sin condiciones de carrera
    select * into v_horario from horarios
    where id = (v_det->>'horario_id')::bigint for update;

    if v_horario.id is null then
      raise exception 'El horario no existe.';
    end if;
    if v_horario.inscritos >= v_horario.cupo then
      raise exception 'La clase % está llena.', v_horario.id;
    end if;

    -- evitar inscribir dos veces al mismo alumno en el mismo horario
    if exists (
      select 1
      from inscripcion_detalles d
      join inscripciones i on i.id = d.inscripcion_id
      where d.horario_id = v_horario.id
        and i.alumno_id = p_alumno_id
        and i.anulada = false
        and i.fecha_fin >= current_date
    ) then
      raise exception 'El alumno ya está inscrito en ese horario.';
    end if;

    v_precio := (v_det->>'precio_mensual')::numeric;
    -- si no mandan precio_lista, se asume que no hubo descuento
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

  return v_id;
end $$;
