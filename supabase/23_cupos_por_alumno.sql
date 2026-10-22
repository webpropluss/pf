-- ============================================================
-- PRIME FIT · Paso 23 · Cupos por alumno vigente
--
-- ANTES: cada horario tenía un contador que subía con cada inscripción
-- y solo bajaba si se ANULABA. Una inscripción vencida seguía ocupando
-- su lugar, y si el alumno renovaba ocupaba dos. En tres meses la misma
-- persona llenaba tres cupos.
--
-- AHORA: un lugar ocupado = un ALUMNO con inscripción vigente (no
-- anulada y que no venció) en ese horario. Se cuentan alumnos
-- distintos: renovar no ocupa otro lugar, y el día después de que
-- vence la mensualidad de quien no renovó, su lugar se libera solo.
--
-- También:
--   • Se puede renovar por adelantado: si vence el 25, la nueva puede
--     empezar el 26 (antes había que anular la anterior).
--   • "Mensualidades por vencer" del Dashboard ya no muestra a quien
--     ya renovó.
--
-- Ejecutar en: SQL Editor → New query → Run
-- Es seguro ejecutarlo varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1) "Hoy" en Bolivia. La base corre en hora de Londres: sin esto,
--    desde las 20:00 creería que ya es mañana y daría por vencidas
--    inscripciones que vencen hoy.
-- ------------------------------------------------------------
create or replace function hoy_bolivia()
returns date
language sql stable as $$
  select (now() at time zone 'America/La_Paz')::date
$$;

-- ------------------------------------------------------------
-- 2) Cuántos alumnos ocupan hoy un lugar en un horario
-- ------------------------------------------------------------
create or replace function ocupacion_horario(p_horario_id bigint)
returns int
language sql stable security definer as $$
  select count(distinct i.alumno_id)::int
    from inscripcion_detalles d
    join inscripciones i on i.id = d.inscripcion_id
   where d.horario_id = p_horario_id
     and i.anulada = false
     and i.fecha_fin >= hoy_bolivia()
$$;

-- ------------------------------------------------------------
-- 3) Recalcular el contador de todos los horarios.
--    La app lo llama al abrir Horarios y al empezar una inscripción,
--    así los vencimientos se reflejan solos cada día.
-- ------------------------------------------------------------
create or replace function recalcular_cupos()
returns void
language plpgsql security definer as $$
begin
  update horarios h
     set inscritos = ocupacion_horario(h.id)
   where h.inscritos is distinct from ocupacion_horario(h.id);
end $$;

-- ------------------------------------------------------------
-- 4) Inscribir: valida por alumnos vigentes y permite renovar
-- ------------------------------------------------------------
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
  v_ya_esta  boolean;
  v_ocupados int;
  v_nuevos   int;
  v_cruce_ini date;
  v_cruce_fin date;
begin
  if p_fecha_fin < p_fecha_inicio then
    raise exception 'La fecha de fin es anterior a la de inicio.';
  end if;

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
    -- 1) Que las fechas no se crucen con otra inscripción suya en ese
    --    mismo horario. Renovar por adelantado SÍ se puede: si vence
    --    el 25, la nueva puede empezar el 26.
    select i.fecha_inicio, i.fecha_fin into v_cruce_ini, v_cruce_fin
      from inscripcion_detalles d
      join inscripciones i on i.id = d.inscripcion_id
     where d.horario_id = v_horario.id
       and i.alumno_id  = p_alumno_id
       and i.anulada    = false
       and i.fecha_inicio <= p_fecha_fin
       and i.fecha_fin    >= p_fecha_inicio
     limit 1;
    if found then
      raise exception 'El alumno ya tiene ese horario del % al %. La nueva inscripción debe empezar desde el %.',
        to_char(v_cruce_ini, 'DD/MM/YYYY'), to_char(v_cruce_fin, 'DD/MM/YYYY'),
        to_char(v_cruce_fin + 1, 'DD/MM/YYYY');
    end if;

    -- 2) El cupo se mide en ALUMNOS con inscripción vigente, no en
    --    inscripciones. Si el alumno ya ocupa un lugar en esta clase
    --    (está renovando), no ocupa otro.
    v_ya_esta := exists (
      select 1 from inscripcion_detalles d
      join inscripciones i on i.id = d.inscripcion_id
      where d.horario_id = v_horario.id and i.alumno_id = p_alumno_id
        and i.anulada = false and i.fecha_fin >= hoy_bolivia());
    v_ocupados := ocupacion_horario(v_horario.id);
    if not v_ya_esta and v_ocupados >= v_horario.cupo
       and p_fecha_fin >= hoy_bolivia() then
      raise exception 'La clase % % está llena: % de % lugares ocupados.',
        v_horario.dias, v_horario.hora_inicio, v_ocupados, v_horario.cupo;
    end if;

    v_precio := (v_det->>'precio_mensual')::numeric;
    v_lista  := coalesce((v_det->>'precio_lista')::numeric, v_precio);

    insert into inscripcion_detalles
      (inscripcion_id, disciplina_id, horario_id, precio_mensual, precio_lista, meses)
    values (v_id, (v_det->>'disciplina_id')::bigint, v_horario.id,
            v_precio, v_lista, (v_det->>'meses')::int);

    v_nuevos := ocupacion_horario(v_horario.id);
    update horarios set inscritos = v_nuevos where id = v_horario.id;

    insert into movimientos_cupo (horario_id, tipo, cantidad, inscritos_resultante, motivo, referencia)
    values (v_horario.id, 'inscripcion', v_nuevos - v_ocupados, v_nuevos,
            case when v_ya_esta then 'Renovación (no ocupa otro lugar)'
                 when v_lista > v_precio then 'Inscripción con precio especial'
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
-- 5) Avisos de vencimiento: no avisar a quien ya renovó
-- ------------------------------------------------------------
create or replace function inscripciones_por_vencer(p_dias int default 3)
returns table (
  inscripcion_id bigint,
  alumno_id      bigint,
  alumno_nombre  text,
  telefono       text,
  fecha_fin      date
)
language sql security definer as $$
  select i.id, a.id, a.nombre, a.telefono, i.fecha_fin
  from inscripciones i
  join alumnos a on a.id = i.alumno_id
  where i.anulada = false
    and a.activo = true
    and a.telefono <> ''
    and i.fecha_fin between hoy_bolivia() and hoy_bolivia() + p_dias
    and not exists (select 1 from avisos_whatsapp w where w.inscripcion_id = i.id)
    -- ya tiene otra inscripción que sigue después de esta: renovó
    and not exists (select 1 from inscripciones n
                     where n.alumno_id = i.alumno_id and n.anulada = false
                       and n.id <> i.id and n.fecha_fin > i.fecha_fin)
$$;

-- ------------------------------------------------------------
-- 6) Corregir ya mismo los contadores inflados
-- ------------------------------------------------------------
select recalcular_cupos();

-- Comprobación: cómo quedó cada horario
select h.id, d.nombre as disciplina, h.dias, h.hora_inicio, h.cupo, h.inscritos as ocupados
  from horarios h left join disciplinas d on d.id = h.disciplina_id
 order by d.nombre, h.hora_inicio;
