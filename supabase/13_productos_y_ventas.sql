-- ============================================================
-- PRIME FIT · Productos y Ventas (mismo patrón maestro–detalle
-- que las inscripciones, pero con stock en vez de cupos)
--
-- Ejecutar en: SQL Editor → New query → Run
-- Si sale "Potential issues detected", elige "Run and enable RLS".
-- ============================================================

-- ============================================================
-- 1) PRODUCTOS
-- ============================================================

create table if not exists productos (
  id             bigint generated always as identity primary key,
  codigo         text unique not null,
  nombre         text not null,
  categoria      text default 'Otros',      -- Suplementos, Bebidas, Accesorios...
  precio_compra  numeric(10,2) not null default 0,   -- lo que cuesta al proveedor
  precio_venta   numeric(10,2) not null default 0,   -- lo que se le cobra al cliente
  stock          int not null default 0,
  stock_minimo   int not null default 3,             -- avisa cuando queda poco
  activo         boolean not null default true
);

create index if not exists productos_nombre_idx on productos (lower(nombre));

-- ============================================================
-- 2) VENTAS (maestro) Y SU DETALLE
-- ============================================================

create table if not exists ventas (
  id             bigint generated always as identity primary key,
  numero         int not null,                       -- correlativo del día
  fecha          timestamptz not null default now(),
  subtotal       numeric(10,2) not null default 0,
  descuento      numeric(10,2) not null default 0,
  total          numeric(10,2) not null default 0,
  costo          numeric(10,2) not null default 0,   -- suma de precios de compra
  ganancia       numeric(10,2) not null default 0,   -- total − costo
  metodo_pago    text not null default 'Efectivo',
  usuario_nombre text default '',
  anulada        boolean not null default false
);

create index if not exists ventas_fecha_idx on ventas (fecha);

create table if not exists venta_detalles (
  id              bigint generated always as identity primary key,
  venta_id        bigint not null references ventas(id) on delete cascade,
  producto_id     bigint references productos(id) on delete set null,
  nombre_producto text not null,                     -- copia, por si luego se borra el producto
  precio_unitario numeric(10,2) not null,
  precio_compra   numeric(10,2) not null default 0,
  cantidad        int not null check (cantidad > 0)
);

-- Bitácora de stock: igual que la de cupos de los horarios
create table if not exists movimientos_stock (
  id                bigint generated always as identity primary key,
  fecha             timestamptz not null default now(),
  producto_id       bigint references productos(id) on delete cascade,
  tipo              text not null default 'ajuste',  -- venta, compra, ajuste, devolucion
  cantidad          int not null,                    -- negativo si sale, positivo si entra
  stock_resultante  int not null,
  motivo            text default '',
  referencia        text default ''
);

-- ============================================================
-- 3) EL COBRO DE LA VENTA ENTRA A LA MISMA CAJA
--    Así el dinero de productos aparece solo en Dashboard y Reportes.
-- ============================================================

alter table pagos add column if not exists venta_id bigint references ventas(id) on delete cascade;

-- Una venta no tiene alumno: la columna pasa a poder ir vacía
alter table pagos alter column alumno_id drop not null;

-- Un pago viene de UNA sola cosa: inscripción, pase del día o venta
alter table pagos drop constraint if exists pagos_origen_valido;
alter table pagos add constraint pagos_origen_valido check (
  (inscripcion_id is not null)::int +
  (pase_dia_id    is not null)::int +
  (venta_id       is not null)::int = 1
);

-- ============================================================
-- 4) SEGURIDAD
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['productos','ventas','venta_detalles','movimientos_stock']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists autenticados_todo on %I', t);
    execute format(
      'create policy autenticados_todo on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ============================================================
-- 5) REGISTRAR UNA VENTA
--    Valida el stock, lo descuenta, deja la bitácora y cobra.
--    Todo dentro de una transacción, como las inscripciones.
-- ============================================================

create or replace function crear_venta(
  p_detalles       jsonb,   -- [{"producto_id":1,"cantidad":2}, ...]
  p_descuento      numeric,
  p_metodo_pago    text,
  p_usuario_nombre text
) returns bigint
language plpgsql security definer as $$
declare
  v_id       bigint;
  v_numero   int;
  v_subtotal numeric := 0;
  v_costo    numeric := 0;
  v_total    numeric := 0;
  v_det      jsonb;
  v_prod     productos%rowtype;
  v_cant     int;
begin
  if p_detalles is null or jsonb_array_length(p_detalles) = 0 then
    raise exception 'La venta debe tener al menos un producto.';
  end if;

  select coalesce(max(numero), 0) + 1 into v_numero
  from ventas where fecha::date = current_date;

  insert into ventas (numero, metodo_pago, usuario_nombre)
  values (v_numero, coalesce(p_metodo_pago, 'Efectivo'), coalesce(p_usuario_nombre, ''))
  returning id into v_id;

  for v_det in select * from jsonb_array_elements(p_detalles) loop
    v_cant := (v_det->>'cantidad')::int;
    if v_cant is null or v_cant <= 0 then
      raise exception 'La cantidad debe ser mayor a cero.';
    end if;

    -- bloquear el producto para que dos cajas no vendan el mismo stock
    select * into v_prod from productos
    where id = (v_det->>'producto_id')::bigint for update;

    if v_prod.id is null then
      raise exception 'El producto no existe.';
    end if;
    if v_prod.stock < v_cant then
      raise exception 'No hay stock suficiente de "%": quedan % y se piden %.',
        v_prod.nombre, v_prod.stock, v_cant;
    end if;

    insert into venta_detalles
      (venta_id, producto_id, nombre_producto, precio_unitario, precio_compra, cantidad)
    values (v_id, v_prod.id, v_prod.nombre, v_prod.precio_venta, v_prod.precio_compra, v_cant);

    update productos set stock = stock - v_cant where id = v_prod.id;

    insert into movimientos_stock
      (producto_id, tipo, cantidad, stock_resultante, motivo, referencia)
    values (v_prod.id, 'venta', -v_cant, v_prod.stock - v_cant,
            'Venta al cliente', 'VTA-' || v_id);

    v_subtotal := v_subtotal + v_prod.precio_venta * v_cant;
    v_costo    := v_costo    + v_prod.precio_compra * v_cant;
  end loop;

  v_total := greatest(v_subtotal - coalesce(p_descuento, 0), 0);

  update ventas
     set subtotal  = v_subtotal,
         descuento = coalesce(p_descuento, 0),
         total     = v_total,
         costo     = v_costo,
         ganancia  = v_total - v_costo
   where id = v_id;

  -- El cobro entra a la caja general
  if v_total > 0 then
    insert into pagos (venta_id, monto, metodo, concepto, usuario_nombre)
    values (v_id, v_total, coalesce(p_metodo_pago, 'Efectivo'),
            'Venta de productos', coalesce(p_usuario_nombre, ''));
  end if;

  return v_id;
end $$;

-- ============================================================
-- 6) ANULAR UNA VENTA: devuelve el stock y conserva el registro
--    (el cobro se borra, porque la venta no ocurrió)
-- ============================================================

create or replace function anular_venta(p_venta_id bigint, p_usuario_nombre text)
returns void
language plpgsql security definer as $$
declare
  v_det record;
begin
  if not exists (select 1 from ventas where id = p_venta_id and anulada = false) then
    raise exception 'La venta no existe o ya fue anulada.';
  end if;

  for v_det in
    select producto_id, cantidad, nombre_producto
    from venta_detalles where venta_id = p_venta_id and producto_id is not null
  loop
    update productos set stock = stock + v_det.cantidad where id = v_det.producto_id;

    insert into movimientos_stock
      (producto_id, tipo, cantidad, stock_resultante, motivo, referencia)
    select v_det.producto_id, 'devolucion', v_det.cantidad, p.stock,
           'Venta anulada por ' || coalesce(p_usuario_nombre, ''), 'VTA-' || p_venta_id
    from productos p where p.id = v_det.producto_id;
  end loop;

  delete from pagos where venta_id = p_venta_id;
  update ventas set anulada = true where id = p_venta_id;
end $$;

-- Borrado definitivo (para errores y pruebas): devuelve el stock si seguía vigente
create or replace function eliminar_venta(p_venta_id bigint)
returns void
language plpgsql security definer as $$
declare
  v_anulada boolean;
  v_det record;
begin
  select anulada into v_anulada from ventas where id = p_venta_id;
  if v_anulada is null then
    raise exception 'La venta no existe.';
  end if;

  if v_anulada = false then
    for v_det in
      select producto_id, cantidad from venta_detalles
      where venta_id = p_venta_id and producto_id is not null
    loop
      update productos set stock = stock + v_det.cantidad where id = v_det.producto_id;
    end loop;
  end if;

  delete from movimientos_stock where referencia = 'VTA-' || p_venta_id;
  delete from ventas where id = p_venta_id;   -- detalles y pago, por cascada
end $$;

-- ============================================================
-- 7) AJUSTAR EL STOCK (cuando llega mercadería o se corrige)
-- ============================================================

create or replace function ajustar_stock(
  p_producto_id bigint,
  p_nuevo_stock int,
  p_motivo      text,
  p_usuario     text
) returns void
language plpgsql security definer as $$
declare
  v_actual int;
  v_dif    int;
begin
  select stock into v_actual from productos where id = p_producto_id for update;
  if v_actual is null then
    raise exception 'El producto no existe.';
  end if;
  if p_nuevo_stock < 0 then
    raise exception 'El stock no puede ser negativo.';
  end if;

  v_dif := p_nuevo_stock - v_actual;
  if v_dif = 0 then return; end if;

  update productos set stock = p_nuevo_stock where id = p_producto_id;

  insert into movimientos_stock
    (producto_id, tipo, cantidad, stock_resultante, motivo, referencia)
  values (p_producto_id,
          case when v_dif > 0 then 'compra' else 'ajuste' end,
          v_dif, p_nuevo_stock,
          coalesce(nullif(p_motivo, ''), 'Ajuste manual'),
          coalesce(p_usuario, ''));
end $$;

-- Eliminar un producto: se bloquea si ya se vendió (perdería el historial)
create or replace function eliminar_producto(p_id bigint)
returns void
language plpgsql security definer as $$
declare v_ventas bigint;
begin
  select count(*) into v_ventas from venta_detalles where producto_id = p_id;
  if v_ventas > 0 then
    raise exception 'No se puede eliminar: este producto aparece en % venta(s). Desactívalo con 🚫 para dejar de venderlo.', v_ventas;
  end if;
  delete from movimientos_stock where producto_id = p_id;
  delete from productos where id = p_id;
end $$;

-- ============================================================
-- 8) PRODUCTOS DE EJEMPLO (se pueden borrar o editar)
-- ============================================================
insert into productos (codigo, nombre, categoria, precio_compra, precio_venta, stock) values
  ('PRO-001', 'Agua 600 ml',            'Bebidas',     3,   5,  24),
  ('PRO-002', 'Agua 1 L',               'Bebidas',     5,   8,  12),
  ('PRO-003', 'Proteína Whey 1 kg',     'Suplementos', 220, 300,  6),
  ('PRO-004', 'Creatina 300 g',         'Suplementos', 120, 170,  4),
  ('PRO-005', 'Preentreno 30 servicios','Suplementos', 130, 190,  3),
  ('PRO-006', 'Guantes de boxeo',       'Accesorios',  90,  150,  5),
  ('PRO-007', 'Vendas para manos',      'Accesorios',  15,  30,  10),
  ('PRO-008', 'Protector bucal',        'Accesorios',  12,  25,   8)
on conflict (codigo) do nothing;
