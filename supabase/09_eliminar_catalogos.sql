-- ============================================================
-- PRIME FIT · Eliminar disciplinas, horarios, instructores e inscripciones
-- Ejecutar en: SQL Editor → New query → Run
--
-- Criterio de seguridad:
--   Se BLOQUEA el borrado cuando hay historial de dinero de por medio
--   (inscripciones), porque eso descuadraría los reportes. El sistema
--   avisa exactamente qué hay que borrar primero.
--   El orden para limpiar datos de prueba es:
--     inscripción  →  horario  →  disciplina / instructor
-- ============================================================

-- ============================================================
-- 1) CONSULTAS DE USO (para avisar antes de borrar)
-- ============================================================

create or replace function usos_disciplina(p_id bigint)
returns table (horarios bigint, inscripciones bigint)
language sql security definer as $$
  select (select count(*) from horarios              where disciplina_id = p_id),
         (select count(*) from inscripcion_detalles  where disciplina_id = p_id);
$$;

create or replace function usos_horario(p_id bigint)
returns table (inscripciones bigint, asistencias bigint, pases bigint)
language sql security definer as $$
  select (select count(*) from inscripcion_detalles where horario_id = p_id),
         (select count(*) from asistencias          where horario_id = p_id),
         (select count(*) from pases_dia            where horario_id = p_id);
$$;

create or replace function usos_instructor(p_id bigint)
returns table (horarios bigint)
language sql security definer as $$
  select (select count(*) from horarios where instructor_id = p_id);
$$;

-- ============================================================
-- 2) ELIMINAR INSCRIPCIÓN DEFINITIVAMENTE
--    (distinto de "anular": anular la deja registrada, esto la borra)
-- ============================================================

create or replace function eliminar_inscripcion(p_inscripcion_id bigint)
returns void
language plpgsql security definer as $$
declare
  v_anulada boolean;
  v_det record;
begin
  select anulada into v_anulada from inscripciones where id = p_inscripcion_id;
  if v_anulada is null then
    raise exception 'La inscripción no existe.';
  end if;

  -- Si seguía vigente, devolver las plazas que ocupaba
  if v_anulada = false then
    for v_det in select horario_id from inscripcion_detalles where inscripcion_id = p_inscripcion_id loop
      update horarios set inscritos = greatest(inscritos - 1, 0) where id = v_det.horario_id;

      insert into movimientos_cupo (horario_id, tipo, cantidad, inscritos_resultante, motivo, referencia)
      select v_det.horario_id, 'baja', -1, h.inscritos,
             'Inscripción eliminada del sistema', 'INS-' || p_inscripcion_id
      from horarios h where h.id = v_det.horario_id;
    end loop;
  end if;

  delete from avisos_whatsapp where inscripcion_id = p_inscripcion_id;
  delete from pagos           where inscripcion_id = p_inscripcion_id;
  delete from inscripciones   where id = p_inscripcion_id;  -- detalles por cascada
end $$;

-- ============================================================
-- 3) ELIMINAR HORARIO
--    Se bloquea si tiene inscripciones. Sus asistencias y su bitácora
--    sí se borran con él; los pases de ese día quedan como "entrada libre".
-- ============================================================

create or replace function eliminar_horario(p_id bigint)
returns void
language plpgsql security definer as $$
declare
  v_ins bigint;
begin
  if not exists (select 1 from horarios where id = p_id) then
    raise exception 'El horario no existe.';
  end if;

  select count(*) into v_ins from inscripcion_detalles where horario_id = p_id;
  if v_ins > 0 then
    raise exception 'No se puede eliminar: este horario tiene % inscripción(es). Elimina primero esas inscripciones desde el módulo Inscripciones.', v_ins;
  end if;

  delete from asistencias      where horario_id = p_id;
  delete from movimientos_cupo where horario_id = p_id;
  delete from horarios         where id = p_id;   -- los pases quedan sin clase fija
end $$;

-- ============================================================
-- 4) ELIMINAR DISCIPLINA
--    Se bloquea si tiene horarios o si aparece en alguna inscripción.
-- ============================================================

create or replace function eliminar_disciplina(p_id bigint)
returns void
language plpgsql security definer as $$
declare
  v_hor bigint;
  v_ins bigint;
begin
  if not exists (select 1 from disciplinas where id = p_id) then
    raise exception 'La disciplina no existe.';
  end if;

  select count(*) into v_hor from horarios             where disciplina_id = p_id;
  select count(*) into v_ins from inscripcion_detalles where disciplina_id = p_id;

  if v_ins > 0 then
    raise exception 'No se puede eliminar: esta disciplina aparece en % inscripción(es). Elimina primero esas inscripciones.', v_ins;
  end if;
  if v_hor > 0 then
    raise exception 'No se puede eliminar: esta disciplina tiene % horario(s). Elimina primero esos horarios.', v_hor;
  end if;

  delete from disciplinas where id = p_id;
end $$;

-- ============================================================
-- 5) ELIMINAR INSTRUCTOR
--    Se bloquea si está asignado a algún horario.
-- ============================================================

create or replace function eliminar_instructor(p_id bigint)
returns void
language plpgsql security definer as $$
declare
  v_hor bigint;
begin
  if not exists (select 1 from instructores where id = p_id) then
    raise exception 'El instructor no existe.';
  end if;

  select count(*) into v_hor from horarios where instructor_id = p_id;
  if v_hor > 0 then
    raise exception 'No se puede eliminar: está asignado a % clase(s). Cámbiales de instructor o elimina esos horarios primero.', v_hor;
  end if;

  delete from instructores where id = p_id;
end $$;
