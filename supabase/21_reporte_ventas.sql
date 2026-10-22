-- ============================================================
-- PRIME FIT · Paso 21 · Reporte de ventas (inversión y ganancia)
--
-- Para saber cuánto se INVIRTIÓ en mercadería en un rango de fechas
-- hace falta que cada entrada de stock guarde a cuánto se compró.
-- Hasta ahora la bitácora (movimientos_stock) solo guardaba cuántas
-- unidades entraron, no su costo.
--
-- Este paso:
--   1) Agrega el costo unitario a cada movimiento de stock.
--   2) Lo llena SOLO en cada movimiento nuevo (con el precio de compra
--      que tiene el producto en ese momento), sin tocar las funciones
--      de venta, regalo ni ajuste que ya funcionan.
--   3) Rellena los movimientos viejos con el precio de compra actual.
--   4) Anota el "Stock inicial" de cada producto, que antes no dejaba
--      rastro en la bitácora (se cargaba directo al crear el producto).
--
-- Ejecutar en: SQL Editor → New query → Run
-- Es seguro ejecutarlo varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1) El costo unitario en la bitácora
-- ------------------------------------------------------------
alter table movimientos_stock
  add column if not exists costo_unitario numeric(10,2);

comment on column movimientos_stock.costo_unitario is
  'Precio de compra del producto en el momento del movimiento. Sirve para '
  'saber cuánto se invirtió en cada entrada de mercadería.';

create index if not exists movimientos_stock_fecha_idx on movimientos_stock (fecha);

-- ------------------------------------------------------------
-- 2) Cada movimiento nuevo guarda el costo solo
--    (venta, regalo, reposición, ajuste: todos pasan por aquí)
-- ------------------------------------------------------------
create or replace function movimiento_con_costo()
returns trigger
language plpgsql as $$
begin
  if new.costo_unitario is null then
    select precio_compra into new.costo_unitario
    from productos where id = new.producto_id;
  end if;
  return new;
end $$;

drop trigger if exists movimientos_stock_costo on movimientos_stock;
create trigger movimientos_stock_costo
  before insert on movimientos_stock
  for each row execute function movimiento_con_costo();

-- ------------------------------------------------------------
-- 3) Un producto nuevo con stock inicial deja su entrada anotada
--    (es una compra: esa mercadería costó plata)
-- ------------------------------------------------------------
create or replace function producto_stock_inicial()
returns trigger
language plpgsql security definer as $$
begin
  if coalesce(new.stock, 0) > 0 then
    insert into movimientos_stock
      (producto_id, tipo, cantidad, stock_resultante, motivo, referencia, costo_unitario)
    values (new.id, 'compra', new.stock, new.stock, 'Stock inicial', 'ALTA', new.precio_compra);
  end if;
  return new;
end $$;

drop trigger if exists productos_stock_inicial on productos;
create trigger productos_stock_inicial
  after insert on productos
  for each row execute function producto_stock_inicial();

-- ------------------------------------------------------------
-- 4) Datos que ya existían
-- ------------------------------------------------------------

-- 4a) Movimientos viejos sin costo: se usa el precio de compra actual
update movimientos_stock m
   set costo_unitario = p.precio_compra
  from productos p
 where p.id = m.producto_id
   and m.costo_unitario is null;

-- 4b) El stock con que se dio de alta cada producto no tenía movimiento.
--     Se calcula como: stock de hoy − suma de todo lo que entró y salió.
--     Se fecha justo antes de su primer movimiento; si nunca tuvo
--     ninguno, con la fecha de hoy.
insert into movimientos_stock
  (fecha, producto_id, tipo, cantidad, stock_resultante, motivo, referencia, costo_unitario)
select coalesce(m.primera - interval '1 second', now()),
       p.id, 'compra',
       p.stock - coalesce(m.suma, 0),
       p.stock - coalesce(m.suma, 0),
       'Stock inicial', 'ALTA', p.precio_compra
  from productos p
  left join (
    select producto_id, sum(cantidad) as suma, min(fecha) as primera
      from movimientos_stock group by producto_id
  ) m on m.producto_id = p.id
 where p.stock - coalesce(m.suma, 0) > 0
   and not exists (select 1 from movimientos_stock x
                    where x.producto_id = p.id and x.referencia = 'ALTA');

-- ------------------------------------------------------------
-- Comprobación: stock de cada producto vs. lo que dice la bitácora.
-- La columna "cuadra" debe decir true en todos.
-- ------------------------------------------------------------
select p.codigo, p.nombre, p.stock,
       coalesce(sum(m.cantidad), 0)          as segun_bitacora,
       p.stock = coalesce(sum(m.cantidad), 0) as cuadra
  from productos p
  left join movimientos_stock m on m.producto_id = p.id
 group by p.id
 order by p.codigo;
