# Prime Fit · versión 33

Reporte de ventas con inversión y ganancia, y el Dashboard cuenta como ingreso
solo la **ganancia** de los productos.

## ⚠️ Pasos para actualizar

1. Ejecuta **`supabase/21_reporte_ventas.sql`** en el SQL Editor (es seguro repetirlo).
   Al final muestra una tabla con la columna **cuadra**: debe decir `true` en todos.
2. Sube la carpeta. Abajo del menú debe decir **v33**.

## 1 · Reportes → pestaña "🛒 Ventas de productos"

Filtra por fechas (Desde / Hasta) y muestra:

| Tarjeta | Qué es |
|---|---|
| **Invertido en compras** | Mercadería que entró en el rango × su precio de compra |
| **Inversión vendida** | Lo que costó lo que se vendió |
| **Vendido (cobrado)** | Lo que pagaron los clientes (ya con descuentos) |
| **Ganancia** | Vendido − inversión vendida |
| **Saldo de inversión** | Invertido − inversión vendida (lo comprado que falta vender) |

Abajo:
- **Cómo se mueve la inversión**: mercadería en stock al inicio + saldo − regalos
  ± ajustes = mercadería en stock al cierre del rango.
- **Por producto**: comprado, vendido, costo, ganancia, saldo y stock al cierre.
- **Compras de mercadería del rango**: cada reposición con su costo.
- **Exportar a Excel** saca 4 hojas: Resumen, Por producto, Compras, Ventas.

Solo la ve quien tiene el permiso `verGanancias` (hoy: Administrador).

## 2 · Dashboard

**Ingresos del período = Inscripciones + Pases del día + Ganancia de productos.**
Del cobro de una venta solo cuenta la ganancia; el resto es el costo de la
mercadería. La tarjeta muestra el desglose de los tres, y el gráfico usa el mismo
criterio. Nueva tarjeta **Ganancia en productos** (solo Administrador).

## Por qué hizo falta SQL

La bitácora de stock no guardaba **a cuánto se compró** cada entrada, y el stock
con que se creaba un producto no quedaba anotado. El paso 21:
- agrega el costo a cada movimiento (se llena solo, sin tocar ventas ni regalos);
- anota el "Stock inicial" de los productos que ya existen, con la fecha justo
  antes de su primer movimiento (o hoy, si nunca tuvieron uno);
- desde ahora, crear un producto con stock cuenta como compra.

Los movimientos anteriores toman el precio de compra **actual** del producto
(no había otro dato).
