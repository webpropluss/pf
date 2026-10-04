-- ============================================================
-- PRIME FIT · Paso 18 · Arreglo de los códigos (INS-, ALU-, PRO-, DIS-, VIS-)
--
-- EL PROBLEMA
-- El código nuevo se calculaba CONTANDO las filas: si había 2
-- instructores, el siguiente era el INS-003. Eso funciona solo
-- mientras nunca se borre nada.
--
-- Como después agregamos poder eliminar instructores, alumnos,
-- disciplinas y productos, la cuenta dejó de coincidir con los
-- códigos que realmente existen:
--
--   existen INS-001 y INS-003 (se borró el INS-002)
--   → hay 2 filas → propone INS-003 → YA EXISTE → error
--
-- LA SOLUCIÓN
-- Mirar el número MÁS ALTO que ya existe con ese prefijo y sumarle
-- uno, en vez de contar filas. Con huecos de por medio funciona
-- igual, y nunca repite.
--
-- Ejecutar en: SQL Editor → New query → Run
-- Si sale "Potential issues detected", elige "Run and enable RLS".
-- Es seguro ejecutarlo varias veces.
-- ============================================================

create or replace function siguiente_codigo(p_tabla text, p_prefijo text)
returns text
language plpgsql security definer as $$
declare
  v_max int;
  v_patron text;
begin
  -- Lista blanca: esta función arma SQL al vuelo, así que solo se
  -- aceptan estas tablas y prefijos con esta forma exacta.
  if p_tabla not in ('alumnos', 'instructores', 'disciplinas', 'productos') then
    raise exception 'Tabla no permitida para generar código: %', p_tabla;
  end if;
  if p_prefijo is null or p_prefijo !~ '^[A-Z]{2,5}$' then
    raise exception 'Prefijo inválido: %', p_prefijo;
  end if;

  v_patron := '^' || p_prefijo || '-[0-9]+$';

  -- El número más alto que ya existe con ese prefijo (0 si no hay ninguno).
  -- Los VIS- de los pases del día y los ALU- conviven en la misma tabla,
  -- y cada uno lleva su propia numeración gracias al filtro del prefijo.
  execute format(
    'select coalesce(max(substring(codigo from ''[0-9]+$'')::int), 0) from %I where codigo ~ $1',
    p_tabla)
  into v_max
  using v_patron;

  -- OJO: lpad() en Postgres RECORTA si el texto es más largo que el
  -- ancho pedido (lpad('1000',3,'0') devuelve '100'). Por eso solo se
  -- rellena mientras quepa en 3 dígitos; del 1000 en adelante va entero.
  return p_prefijo || '-' || case
    when v_max + 1 < 1000 then lpad((v_max + 1)::text, 3, '0')
    else (v_max + 1)::text
  end;
end $$;

-- ------------------------------------------------------------
-- Comprobación: debería devolver el siguiente de cada uno,
-- saltándose los huecos que hayan dejado los borrados.
-- ------------------------------------------------------------
select 'instructores' as tabla, siguiente_codigo('instructores', 'INS') as siguiente
union all select 'alumnos',      siguiente_codigo('alumnos', 'ALU')
union all select 'visitantes',   siguiente_codigo('alumnos', 'VIS')
union all select 'disciplinas',  siguiente_codigo('disciplinas', 'DIS')
union all select 'productos',    siguiente_codigo('productos', 'PRO');
