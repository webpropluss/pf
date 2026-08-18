-- ============================================================
-- PRIME FIT · Esquema de base de datos para Supabase (Postgres)
-- Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
-- ============================================================

-- ---------- CATÁLOGOS ----------

create table if not exists disciplinas (
  id              bigint generated always as identity primary key,
  codigo          text unique not null,
  nombre          text not null,
  descripcion     text default '',
  precio_mensual  numeric(10,2) not null default 0,
  activo          boolean not null default true
);

create table if not exists instructores (
  id            bigint generated always as identity primary key,
  codigo        text unique not null,
  nombre        text not null,
  telefono      text default '',
  especialidad  text default '',
  activo        boolean not null default true
);

create table if not exists horarios (
  id             bigint generated always as identity primary key,
  disciplina_id  bigint not null references disciplinas(id),
  instructor_id  bigint not null references instructores(id),
  dias           text not null default 'Lun-Vie',
  hora_inicio    text not null default '07:00',
  hora_fin       text not null default '08:00',
  sala           text not null default 'Sala 1',
  cupo           int  not null default 20,
  inscritos      int  not null default 0,
  activo         boolean not null default true
);

create table if not exists alumnos (
  id               bigint generated always as identity primary key,
  codigo           text unique not null,
  nombre           text not null,
  dni              text default '',
  telefono         text default '',   -- IMPORTANTE: con código de país p/ WhatsApp, ej. 59171234567
  email            text default '',
  fecha_nacimiento date default '1995-01-01',
  direccion        text default '',
  foto_url         text,              -- la foto ya no es BLOB: se guarda en Supabase Storage
  activo           boolean not null default true
);

-- ---------- USUARIOS DEL SISTEMA ----------
-- El login se hace con Supabase Auth (email + contraseña).
-- Esta tabla guarda el rol de cada usuario de Auth.

create table if not exists perfiles (
  id       uuid primary key references auth.users(id) on delete cascade,
  nombre   text not null,
  rol      text not null default 'Recepcionista', -- Administrador, Recepcionista, Cajero, Instructor
  activo   boolean not null default true
);

-- ---------- MAESTRO–DETALLE: INSCRIPCIONES ----------

create table if not exists inscripciones (
  id             bigint generated always as identity primary key,
  numero         int not null,                 -- correlativo del día
  fecha          timestamptz not null default now(),
  alumno_id      bigint not null references alumnos(id),
  fecha_inicio   date not null default current_date,
  fecha_fin      date not null default current_date + interval '1 month',
  subtotal       numeric(10,2) not null default 0,
  descuento      numeric(10,2) not null default 0,
  total          numeric(10,2) not null default 0,
  metodo_pago    text not null default 'Efectivo',
  usuario_nombre text default '',
  anulada        boolean not null default false
);

create table if not exists inscripcion_detalles (
  id              bigint generated always as identity primary key,
  inscripcion_id  bigint not null references inscripciones(id) on delete cascade,
  disciplina_id   bigint not null references disciplinas(id),
  horario_id      bigint not null references horarios(id),
  precio_mensual  numeric(10,2) not null,
  meses           int not null default 1
);

create table if not exists pagos (
  id              bigint generated always as identity primary key,
  fecha           timestamptz not null default now(),
  inscripcion_id  bigint not null references inscripciones(id) on delete cascade,
  alumno_id       bigint not null references alumnos(id),
  monto           numeric(10,2) not null,
  metodo          text not null default 'Efectivo',
  concepto        text not null default 'Mensualidad',
  usuario_nombre  text default ''
);

create table if not exists asistencias (
  id          bigint generated always as identity primary key,
  fecha       date not null,
  alumno_id   bigint not null references alumnos(id),
  horario_id  bigint not null references horarios(id),
  presente    boolean not null default true,
  unique (fecha, alumno_id, horario_id)
);

create table if not exists movimientos_cupo (
  id                   bigint generated always as identity primary key,
  fecha                timestamptz not null default now(),
  horario_id           bigint not null references horarios(id),
  tipo                 text not null default 'ajuste',  -- inscripcion, baja, ajuste
  cantidad             int not null,
  inscritos_resultante int not null,
  motivo               text default '',
  referencia           text default ''
);

create table if not exists config (
  clave text primary key,
  valor text not null default ''
);

-- ---------- AVISOS DE WHATSAPP (Etapa 5) ----------
-- Registro de los mensajes automáticos enviados a los alumnos
-- cuando su inscripción está por vencer.

create table if not exists avisos_whatsapp (
  id              bigint generated always as identity primary key,
  fecha_envio     timestamptz not null default now(),
  alumno_id       bigint not null references alumnos(id),
  inscripcion_id  bigint not null references inscripciones(id),
  telefono        text not null,
  mensaje         text not null,
  estado          text not null default 'pendiente', -- pendiente, enviado, error
  detalle_error   text default '',
  unique (inscripcion_id)  -- un solo aviso por inscripción
);

-- ============================================================
-- FUNCIONES DE NEGOCIO (transaccionales, como en el sistema local)
-- ============================================================

-- Crear inscripción maestro–detalle: valida cupo y duplicados,
-- ocupa plazas y registra los movimientos, todo en una transacción.
create or replace function crear_inscripcion(
  p_alumno_id      bigint,
  p_fecha_inicio   date,
  p_fecha_fin      date,
  p_descuento      numeric,
  p_metodo_pago    text,
  p_usuario_nombre text,
  p_detalles       jsonb   -- [{"disciplina_id":1,"horario_id":2,"precio_mensual":200,"meses":1}, ...]
) returns bigint
language plpgsql security definer as $$
declare
  v_id        bigint;
  v_numero    int;
  v_subtotal  numeric := 0;
  v_det       jsonb;
  v_horario   horarios%rowtype;
begin
  if jsonb_array_length(p_detalles) = 0 then
    raise exception 'La inscripción debe tener al menos una disciplina.';
  end if;

  -- correlativo del día
  select coalesce(max(numero), 0) + 1 into v_numero
  from inscripciones where fecha::date = current_date;

  -- subtotal
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

    -- evitar inscribir dos veces al mismo alumno en el mismo horario (inscripción vigente)
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

    insert into inscripcion_detalles (inscripcion_id, disciplina_id, horario_id, precio_mensual, meses)
    values (v_id, (v_det->>'disciplina_id')::bigint, v_horario.id,
            (v_det->>'precio_mensual')::numeric, (v_det->>'meses')::int);

    update horarios set inscritos = inscritos + 1 where id = v_horario.id;

    insert into movimientos_cupo (horario_id, tipo, cantidad, inscritos_resultante, motivo, referencia)
    values (v_horario.id, 'inscripcion', 1, v_horario.inscritos + 1,
            'Inscripción de alumno', 'INS-' || v_id);
  end loop;

  return v_id;
end $$;

-- Anular inscripción: libera todas las plazas, elimina sus pagos y la marca como anulada.
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
    select v_det.horario_id, 'baja', -1, h.inscritos, 'Anulación por ' || p_usuario_nombre, 'INS-' || p_inscripcion_id
    from horarios h where h.id = v_det.horario_id;
  end loop;

  delete from pagos where inscripcion_id = p_inscripcion_id;
  update inscripciones set anulada = true where id = p_inscripcion_id;
end $$;

-- Inscripciones que vencen en N días y aún no recibieron aviso (para la Etapa 5 de WhatsApp)
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
    and i.fecha_fin between current_date and current_date + p_dias
    and not exists (select 1 from avisos_whatsapp w where w.inscripcion_id = i.id)
$$;

-- ============================================================
-- SEGURIDAD (RLS): solo usuarios autenticados pueden operar
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['disciplinas','instructores','horarios','alumnos','perfiles',
                           'inscripciones','inscripcion_detalles','pagos','asistencias',
                           'movimientos_cupo','config','avisos_whatsapp']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists autenticados_todo on %I', t);
    execute format(
      'create policy autenticados_todo on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ============================================================
-- STORAGE: bucket para las fotos de los alumnos (Etapa 2)
-- Crear también desde el panel: Storage → New bucket → "fotos-alumnos" (público)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('fotos-alumnos', 'fotos-alumnos', true)
on conflict (id) do nothing;

drop policy if exists "fotos_lectura_publica" on storage.objects;
create policy "fotos_lectura_publica" on storage.objects
  for select using (bucket_id = 'fotos-alumnos');

drop policy if exists "fotos_subida_autenticados" on storage.objects;
create policy "fotos_subida_autenticados" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos-alumnos');

drop policy if exists "fotos_borrado_autenticados" on storage.objects;
create policy "fotos_borrado_autenticados" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos-alumnos');
