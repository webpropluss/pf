-- ============================================================
-- PRIME FIT · Pases por día + eliminar alumnos + ficha simplificada
-- Ejecutar en: SQL Editor → New query → Run
-- Si sale "Potential issues detected", elige "Run and enable RLS".
-- ============================================================

-- ============================================================
-- 1) PASES POR DÍA
--    Para la gente que paga y entrena un solo día.
-- ============================================================

create table if not exists pases_dia (
  id             bigint generated always as identity primary key,
  fecha          date not null default current_date,
  alumno_id      bigint not null references alumnos(id) on delete cascade,
  horario_id     bigint references horarios(id) on delete set null,
  monto          numeric(10,2) not null default 0,
  metodo_pago    text not null default 'Efectivo',
  observacion    text default '',
  usuario_nombre text default '',
  creado_en      timestamptz not null default now()
);

create index if not exists pases_dia_fecha_idx on pases_dia (fecha);

alter table pases_dia enable row level security;
drop policy if exists autenticados_todo on pases_dia;
create policy autenticados_todo on pases_dia
  for all to authenticated using (true) with check (true);

-- El precio sugerido del pase se configura en el módulo Configuración
insert into config (clave, valor) values ('precio_pase_dia', '25')
on conflict (clave) do nothing;

-- ============================================================
-- 2) LOS PAGOS AHORA TAMBIÉN PUEDEN VENIR DE UN PASE DEL DÍA
--    Así el dinero del pase aparece solo en Dashboard, Pagos y Reportes.
-- ============================================================

alter table pagos alter column inscripcion_id drop not null;

alter table pagos
  add column if not exists pase_dia_id bigint references pases_dia(id) on delete cascade;

-- Un pago pertenece a una inscripción O a un pase del día, no a los dos
alter table pagos drop constraint if exists pagos_origen_valido;
alter table pagos add constraint pagos_origen_valido check (
  (inscripcion_id is not null and pase_dia_id is null) or
  (inscripcion_id is null     and pase_dia_id is not null)
);

-- ============================================================
-- 3) REGISTRAR UN PASE DEL DÍA (crea el pase y su pago, junto)
-- ============================================================

create or replace function crear_pase_dia(
  p_alumno_id      bigint,
  p_fecha          date,
  p_horario_id     bigint,
  p_monto          numeric,
  p_metodo_pago    text,
  p_observacion    text,
  p_usuario_nombre text
) returns bigint
language plpgsql security definer as $$
declare
  v_id bigint;
begin
  if p_alumno_id is null then
    raise exception 'Falta indicar la persona del pase.';
  end if;
  if p_monto is null or p_monto < 0 then
    raise exception 'El monto del pase no es válido.';
  end if;

  insert into pases_dia (fecha, alumno_id, horario_id, monto, metodo_pago, observacion, usuario_nombre)
  values (coalesce(p_fecha, current_date), p_alumno_id, p_horario_id,
          p_monto, coalesce(p_metodo_pago, 'Efectivo'),
          coalesce(p_observacion, ''), coalesce(p_usuario_nombre, ''))
  returning id into v_id;

  -- El cobro se registra como un pago normal, para que sume en los reportes
  if p_monto > 0 then
    insert into pagos (fecha, pase_dia_id, alumno_id, monto, metodo, concepto, usuario_nombre)
    values (case when coalesce(p_fecha, current_date) = current_date
                 then now()                                    -- hoy: hora real
                 else coalesce(p_fecha, current_date) + time '12:00'   -- otro día: mediodía
            end,
            v_id, p_alumno_id, p_monto, coalesce(p_metodo_pago, 'Efectivo'),
            'Pase del día', coalesce(p_usuario_nombre, ''));
  end if;

  return v_id;
end $$;

-- Eliminar un pase del día (borra también su pago, por la cascada)
create or replace function eliminar_pase_dia(p_pase_id bigint)
returns void
language sql security definer as $$
  delete from pases_dia where id = p_pase_id;
$$;

-- ============================================================
-- 4) ELIMINAR ALUMNOS DE VERDAD
-- ============================================================

-- Cuántos movimientos tiene un alumno (para avisar antes de borrar)
create or replace function historial_alumno(p_alumno_id bigint)
returns table (inscripciones bigint, pagos bigint, asistencias bigint, pases bigint)
language sql security definer as $$
  select
    (select count(*) from inscripciones where alumno_id = p_alumno_id),
    (select count(*) from pagos         where alumno_id = p_alumno_id),
    (select count(*) from asistencias   where alumno_id = p_alumno_id),
    (select count(*) from pases_dia     where alumno_id = p_alumno_id);
$$;

-- Borrado definitivo: libera las plazas que ocupaba y elimina su historial
create or replace function eliminar_alumno(p_alumno_id bigint)
returns void
language plpgsql security definer as $$
declare
  v_det record;
begin
  if not exists (select 1 from alumnos where id = p_alumno_id) then
    raise exception 'El alumno no existe.';
  end if;

  -- Devolver las plazas de sus inscripciones vigentes
  for v_det in
    select d.horario_id
    from inscripcion_detalles d
    join inscripciones i on i.id = d.inscripcion_id
    where i.alumno_id = p_alumno_id and i.anulada = false
  loop
    update horarios set inscritos = greatest(inscritos - 1, 0) where id = v_det.horario_id;

    insert into movimientos_cupo (horario_id, tipo, cantidad, inscritos_resultante, motivo, referencia)
    select v_det.horario_id, 'baja', -1, h.inscritos,
           'Alumno eliminado del sistema', 'ALU-' || p_alumno_id
    from horarios h where h.id = v_det.horario_id;
  end loop;

  -- Borrar su historial y luego al alumno
  delete from asistencias      where alumno_id = p_alumno_id;
  delete from pagos            where alumno_id = p_alumno_id;
  delete from avisos_whatsapp  where alumno_id = p_alumno_id;
  delete from pases_dia        where alumno_id = p_alumno_id;   -- borra sus pagos por cascada
  delete from inscripciones    where alumno_id = p_alumno_id;   -- borra detalles por cascada
  delete from alumnos          where id = p_alumno_id;
end $$;

-- ============================================================
-- 5) FICHA DEL ALUMNO SIMPLIFICADA
--    El sistema ya no pide CI ni dirección. Las columnas se quitan
--    para que la tabla quede limpia. Si prefieres conservar los datos
--    viejos, comenta estas dos líneas: dejarlas no rompe nada.
-- ============================================================

alter table alumnos drop column if exists dni;
alter table alumnos drop column if exists direccion;
