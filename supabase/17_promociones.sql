-- ============================================================
-- PRIME FIT · Paso 17 · Productos de regalo (gasto promocional)
--
-- Cuando se regala mercadería en una inauguración, un sorteo o una
-- dinámica, pasa algo distinto a una venta:
--
--   • SALE del stock, igual que una venta.
--   • NO entra plata: no genera ningún pago, así que no ensucia
--     los ingresos del Dashboard ni de Reportes.
--   • SÍ es un gasto: lo que te costó esa mercadería al proveedor.
--
-- Se guardan dos números por cada regalo:
--   costo       → lo que te costó (precio de compra). Este es el gasto real.
--   valor_venta → lo que habrías cobrado. Sirve para decir "regalamos
--                 Bs. 500 en productos", que es como se habla de promoción.
--
-- Ejecutar en: SQL Editor → New query → Run
-- Si sale "Potential issues detected", elige "Run and enable RLS".
-- Es seguro ejecutarlo varias veces.
-- ============================================================

-- ============================================================
-- 1) LAS TABLAS (maestro–detalle, igual que las ventas)
-- ============================================================

create table if not exists promociones (
  id             bigint generated always as identity primary key,
  numero         int not null,                       -- correlativo del día
  fecha          timestamptz not null default now(),
  motivo         text not null default '',           -- "Inauguración", "Sorteo"...
  entregado_a    text not null default '',           -- opcional, a quién se le dio
  costo          numeric(10,2) not null default 0,   -- lo que te costó: EL GASTO
  valor_venta    numeric(10,2) not null default 0,   -- lo que habrías cobrado
  usuario_nombre text default '',
  anulada        boolean not null default false
);

create index if not exists promociones_fecha_idx on promociones (fecha);

create table if not exists promocion_detalles (
  id                   bigint generated always as identity primary key,
  promocion_id         bigint not null references promociones(id) on delete cascade,
  producto_id          bigint references productos(id) on delete set null,
  nombre_producto      text not null,                -- copia, por si luego se borra
  descripcion_producto text not null default '',
  precio_compra        numeric(10,2) not null default 0,
  precio_venta         numeric(10,2) not null default 0,
  cantidad             int not null check (cantidad > 0)
);

-- ============================================================
-- 2) SEGURIDAD
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['promociones','promocion_detalles']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists autenticados_todo on %I', t);
    execute format(
      'create policy autenticados_todo on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ============================================================
-- 3) REGISTRAR UN REGALO
--    Descuenta el stock y deja la bitácora, pero NO crea ningún pago.
--    Esa es toda la diferencia con una venta.
-- ============================================================

create or replace function crear_promocion(
  p_detalles       jsonb,                  -- [{"producto_id":1,"cantidad":2}, ...]
  p_motivo         text default '',
  p_entregado_a    text default '',
  p_usuario_nombre text default '',
  p_fecha          date default null       -- null = hoy; sirve para cargar un evento pasado
) returns int
language plpgsql security definer as $$
declare
  v_id      bigint;
  v_numero  int;
  v_costo   numeric := 0;
  v_valor   numeric := 0;
  v_det     jsonb;
  v_prod    productos%rowtype;
  v_cant    int;
  v_momento timestamptz;
begin
  if p_detalles is null or jsonb_array_length(p_detalles) = 0 then
    raise exception 'El regalo no tiene productos.';
  end if;

  -- Si mandan fecha, se guarda ese día a mediodía (evita que el huso
  -- horario lo corra al día anterior); si no, el momento exacto.
  v_momento := case when p_fecha is null then now()
                    else p_fecha::timestamp + interval '12 hours' end;

  select coalesce(max(numero), 0) + 1 into v_numero
  from promociones where fecha::date = v_momento::date;

  insert into promociones (numero, fecha, motivo, entregado_a, usuario_nombre)
  values (v_numero, v_momento, coalesce(p_motivo, ''),
          coalesce(p_entregado_a, ''), coalesce(p_usuario_nombre, ''))
  returning id into v_id;

  for v_det in select * from jsonb_array_elements(p_detalles) loop
    v_cant := (v_det->>'cantidad')::int;
    if v_cant is null or v_cant <= 0 then
      raise exception 'La cantidad debe ser mayor a cero.';
    end if;

    -- bloquear el producto para que no se regale y se venda el mismo stock
    select * into v_prod from productos
    where id = (v_det->>'producto_id')::bigint for update;

    if v_prod.id is null then
      raise exception 'El producto no existe.';
    end if;
    if v_prod.stock < v_cant then
      raise exception 'No hay stock suficiente de "%": quedan % y se quieren regalar %.',
        v_prod.nombre, v_prod.stock, v_cant;
    end if;

    insert into promocion_detalles
      (promocion_id, producto_id, nombre_producto, descripcion_producto,
       precio_compra, precio_venta, cantidad)
    values (v_id, v_prod.id, v_prod.nombre, coalesce(v_prod.descripcion, ''),
            v_prod.precio_compra, v_prod.precio_venta, v_cant);

    update productos set stock = stock - v_cant where id = v_prod.id;

    insert into movimientos_stock
      (producto_id, tipo, cantidad, stock_resultante, motivo, referencia, fecha)
    values (v_prod.id, 'promocion', -v_cant, v_prod.stock - v_cant,
            coalesce(nullif(p_motivo, ''), 'Regalo promocional'), 'PRO-' || v_id, v_momento);

    v_costo := v_costo + v_prod.precio_compra * v_cant;
    v_valor := v_valor + v_prod.precio_venta  * v_cant;
  end loop;

  update promociones set costo = v_costo, valor_venta = v_valor where id = v_id;

  -- ¡OJO! Aquí NO se inserta nada en pagos: es justamente lo que hace
  -- que un regalo no aparezca como ingreso en ningún lado.

  return v_numero;
end $$;

-- ============================================================
-- 4) ANULAR (me equivoqué): devuelve el stock y borra el gasto
-- ============================================================

create or replace function anular_promocion(p_promocion_id bigint, p_usuario_nombre text default '')
returns void
language plpgsql security definer as $$
declare v_det record;
begin
  if not exists (select 1 from promociones where id = p_promocion_id and anulada = false) then
    raise exception 'El regalo no existe o ya fue anulado.';
  end if;

  for v_det in
    select producto_id, cantidad from promocion_detalles
    where promocion_id = p_promocion_id and producto_id is not null
  loop
    update productos set stock = stock + v_det.cantidad where id = v_det.producto_id;

    insert into movimientos_stock
      (producto_id, tipo, cantidad, stock_resultante, motivo, referencia)
    select v_det.producto_id, 'devolucion', v_det.cantidad, p.stock,
           'Regalo anulado por ' || coalesce(p_usuario_nombre, ''), 'PRO-' || p_promocion_id
    from productos p where p.id = v_det.producto_id;
  end loop;

  -- El gasto se pone en cero: el regalo no ocurrió
  update promociones set anulada = true, costo = 0, valor_venta = 0
  where id = p_promocion_id;
end $$;

-- ============================================================
-- 5) ELIMINAR del todo (para datos de prueba)
-- ============================================================

create or replace function eliminar_promocion(p_promocion_id bigint)
returns void
language plpgsql security definer as $$
declare
  v_anulada boolean;
  v_det     record;
begin
  select anulada into v_anulada from promociones where id = p_promocion_id;
  if v_anulada is null then
    raise exception 'El regalo no existe.';
  end if;

  -- Si todavía estaba vigente, la mercadería vuelve al stock
  if v_anulada = false then
    for v_det in
      select producto_id, cantidad from promocion_detalles
      where promocion_id = p_promocion_id and producto_id is not null
    loop
      update productos set stock = stock + v_det.cantidad where id = v_det.producto_id;
    end loop;
  end if;

  delete from movimientos_stock where referencia = 'PRO-' || p_promocion_id;
  delete from promociones where id = p_promocion_id;   -- los detalles, por cascada
end $$;

-- ============================================================
-- 6) No borrar un producto que se regaló alguna vez
--    (antes solo se miraban las ventas; ahora también los regalos,
--     para no perder el historial del gasto promocional)
-- ============================================================

create or replace function eliminar_producto(p_id bigint)
returns void
language plpgsql security definer as $$
declare
  v_ventas bigint;
  v_promos bigint;
begin
  select count(*) into v_ventas from venta_detalles     where producto_id = p_id;
  select count(*) into v_promos from promocion_detalles where producto_id = p_id;

  if v_ventas > 0 then
    raise exception 'No se puede eliminar: este producto aparece en % venta(s). Desactívalo con 🚫 para dejar de venderlo.', v_ventas;
  end if;
  if v_promos > 0 then
    raise exception 'No se puede eliminar: este producto se regaló en % promoción(es). Desactívalo con 🚫 para dejar de venderlo.', v_promos;
  end if;

  delete from movimientos_stock where producto_id = p_id;
  delete from productos where id = p_id;
end $$;

-- ------------------------------------------------------------
-- Comprobación
-- ------------------------------------------------------------
select table_name from information_schema.tables
where table_name in ('promociones','promocion_detalles')
order by table_name;
