-- ============================================================
-- PRIME FIT · Paso 15 · Descripción de los productos
--
-- Agrega un campo de texto libre para describir el producto:
-- de qué es, sabor, tamaño, para qué sirve… Sirve sobre todo
-- para distinguir productos parecidos en el buscador de caja
-- (por ejemplo tres bucales de la misma marca).
--
-- Es seguro ejecutarlo varias veces.
-- ============================================================

alter table productos
  add column if not exists descripcion text not null default '';

comment on column productos.descripcion is
  'Texto libre que describe el producto (sabor, tamaño, para qué sirve).';

-- ------------------------------------------------------------
-- La venta guarda también la descripción
--
-- Sin esto, una venta de dos bucales distintos de la misma marca
-- se leería "2× Bucal Venum, 1× Bucal Venum" y no se sabría cuál
-- fue cuál. Se guarda una copia al vender, igual que el nombre,
-- para que el historial no cambie si después editas el producto.
-- ------------------------------------------------------------
alter table venta_detalles
  add column if not exists descripcion_producto text not null default '';

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
      (venta_id, producto_id, nombre_producto, descripcion_producto,
       precio_unitario, precio_compra, cantidad)
    values (v_id, v_prod.id, v_prod.nombre, coalesce(v_prod.descripcion, ''),
            v_prod.precio_venta, v_prod.precio_compra, v_cant);

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

-- ------------------------------------------------------------
-- Comprobación
-- ------------------------------------------------------------
select column_name, data_type, column_default
from information_schema.columns
where (table_name = 'productos' and column_name = 'descripcion')
   or (table_name = 'venta_detalles' and column_name = 'descripcion_producto');
