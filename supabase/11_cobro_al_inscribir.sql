-- ============================================================
-- PRIME FIT · Cobrar al momento de inscribir + anular sin perder el dinero
-- Ejecutar en: SQL Editor → New query → Run
--
-- Dos cambios:
--   1. La inscripción puede registrar su pago en el mismo acto.
--   2. Anular una inscripción YA NO borra sus pagos.
--      El dinero que el alumno pagó, el gimnasio lo ganó: borrarlo
--      descuadraba los ingresos. Anular libera la plaza y deja la
--      inscripción marcada, pero el cobro sigue en los reportes.
-- ============================================================

-- ============================================================
-- 1) CREAR INSCRIPCIÓN COBRANDO EN EL MISMO PASO
--    Se borra la versión anterior porque la función suma un parámetro.
-- ============================================================

drop function if exists crear_inscripcion(bigint, date, date, numeric, text, text, jsonb);

create or replace function crear_inscripcion(
  p_alumno_id      bigint,
  p_fecha_inicio   date,
  p_fecha_fin      date,
  p_descuento      numeric,
  p_metodo_pago    text,
  p_usuario_nombre text,
  p_detalles       jsonb,
  p_pago_inicial   numeric default 0   -- lo que paga en el momento
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
    insert into pagos (inscripcion_id, alumno_id, monto, metodo, concepto, usuario_nombre)
    values (v_id, p_alumno_id, v_cobro, coalesce(p_metodo_pago, 'Efectivo'),
            'Mensualidad', coalesce(p_usuario_nombre, ''));
  end if;

  return v_id;
end $$;

-- ============================================================
-- 2) ANULAR SIN BORRAR EL DINERO COBRADO
--    Libera las plazas y marca la inscripción como anulada,
--    pero los pagos quedan: ese dinero sí entró a la caja.
--    (Si hubo devolución, el pago se borra aparte, desde Pagos.)
-- ============================================================

create or replace function anular_inscripcion(p_inscripcion_id bigint, p_usuario_nombre text)
returns void
language plpgsql security definer as $$
declare
  v_det record;
begin
  if not exists (select 1 from inscripciones where id = p_inscripcion_id and anulada = false) then
    raise exception 'La inscripción no existe o ya fue anulada.';
  end if;

  for v_det in
    select d.horario_id from inscripcion_detalles d where d.inscripcion_id = p_inscripcion_id
  loop
    update horarios set inscritos = greatest(inscritos - 1, 0) where id = v_det.horario_id;
    insert into movimientos_cupo (horario_id, tipo, cantidad, inscritos_resultante, motivo, referencia)
    select v_det.horario_id, 'baja', -1, h.inscritos,
           'Anulación por ' || p_usuario_nombre, 'INS-' || p_inscripcion_id
    from horarios h where h.id = v_det.horario_id;
  end loop;

  -- Los pagos NO se borran: el dinero cobrado sigue en los reportes
  update inscripciones set anulada = true where id = p_inscripcion_id;
end $$;
