-- ============================================================
-- PRIME FIT · Paso 19 · Pase del día simplificado
--
-- El formulario quedó en cuatro cosas: fecha, disciplina, monto y
-- forma de pago. Ya no se pide el nombre del visitante.
--
-- Qué cambia en la base:
--   • alumno_id deja de ser obligatorio (ya no hay a quién anotar)
--   • el pase guarda la DISCIPLINA en vez del horario
--   • dos montos sugeridos configurables (10 y 15)
--
-- Lo ya registrado NO se toca: los pases viejos conservan su
-- visitante y su horario, y se siguen viendo en la lista.
--
-- Ejecutar en: SQL Editor → New query → Run
-- Si sale "Potential issues detected", elige "Run and enable RLS".
-- Es seguro ejecutarlo varias veces.
-- ============================================================

-- 1) El pase ya no exige una persona
alter table pases_dia alter column alumno_id drop not null;

-- 2) Guarda la disciplina. (horario_id se queda por los pases viejos,
--    pero los nuevos ya no lo usan.)
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
-- 4) REGISTRAR UN PASE
--    Cambia la firma (ya no recibe alumno, horario ni observación),
--    así que primero se quita la anterior: si no, quedarían dos y la
--    app no sabría a cuál llamar.
-- ============================================================

drop function if exists crear_pase_dia(bigint, date, bigint, numeric, text, text, text);

create or replace function crear_pase_dia(
  p_fecha          date,
  p_disciplina_id  bigint,
  p_monto          numeric,
  p_metodo_pago    text default 'Efectivo',
  p_usuario_nombre text default ''
) returns bigint
language plpgsql security definer as $$
declare
  v_id    bigint;
  v_fecha date;
begin
  v_fecha := coalesce(p_fecha, current_date);

  if p_monto is null or p_monto < 0 then
    raise exception 'El monto del pase no es válido.';
  end if;

  insert into pases_dia (fecha, disciplina_id, monto, metodo_pago, usuario_nombre)
  values (v_fecha, p_disciplina_id, p_monto,
          coalesce(p_metodo_pago, 'Efectivo'), coalesce(p_usuario_nombre, ''))
  returning id into v_id;

  -- El cobro se registra como un pago normal, para que sume en
  -- Dashboard y Reportes igual que antes.
  if p_monto > 0 then
    insert into pagos (fecha, pase_dia_id, alumno_id, monto, metodo, concepto, usuario_nombre)
    values (case when v_fecha = current_date
                 then now()                          -- hoy: la hora real
                 else v_fecha + time '12:00'         -- otro día: mediodía
            end,
            v_id, null, p_monto, coalesce(p_metodo_pago, 'Efectivo'),
            'Pase del día', coalesce(p_usuario_nombre, ''));
  end if;

  return v_id;
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
  (select valor from config where clave = 'precio_pase_dia')           as monto_1,
  (select valor from config where clave = 'precio_pase_dia_2')         as monto_2;
