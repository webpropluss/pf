-- ============================================================
-- PRIME FIT · Paso 24 · "Por vencer" se mira clase por clase
--
-- CORRIGE un error del paso 23: para saber si alguien "ya renovó" se
-- miraba si tenía CUALQUIER otra inscripción que terminara después.
-- Así, un alumno con Boxeo (vence el 6) e Híbrido (vence el 12) nunca
-- recibía el aviso de Boxeo, porque el Híbrido "parecía" una renovación.
--
-- AHORA: renovó solo si, para cada disciplina de la inscripción que
-- vence, tiene otra inscripción de ESA MISMA disciplina que sigue después.
--
-- Ejecutar en: SQL Editor → New query → Run
-- Es seguro ejecutarlo varias veces.
-- ============================================================

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
    -- Se avisa si al menos UNA de sus disciplinas no tiene renovación
    -- (otra inscripción de esa misma disciplina que termina después)
    and (
      not exists (select 1 from inscripcion_detalles d where d.inscripcion_id = i.id)
      or exists (
        select 1 from inscripcion_detalles d
         where d.inscripcion_id = i.id
           and not exists (
             select 1 from inscripciones n
               join inscripcion_detalles nd on nd.inscripcion_id = n.id
              where n.alumno_id = i.alumno_id and n.anulada = false and n.id <> i.id
                and n.fecha_fin > i.fecha_fin
                and nd.disciplina_id = d.disciplina_id))
    )
$$;
