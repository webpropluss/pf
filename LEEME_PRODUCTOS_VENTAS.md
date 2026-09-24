# 🛒 Productos y Ventas

Dos módulos nuevos, con el mismo patrón maestro–detalle de las inscripciones:
la venta es el maestro, los productos son el detalle, y el **stock funciona
como el cupo de los horarios** (se descuenta al vender, vuelve al anular).

## ⚠ Ejecutar el SQL
`supabase/13_productos_y_ventas.sql` en el SQL Editor → **Run**.
Trae 8 productos de ejemplo (aguas, proteína, creatina, guantes…) que puedes
editar o borrar.

---

## 📦 Productos — solo el administrador

Cada producto lleva:

| Dato | Para qué |
|---|---|
| **Precio de compra** | Lo que te cuesta al proveedor |
| **Precio de venta** | Lo que le cobras al cliente |
| **Stock** | Cuántos tienes |
| **Avisar cuando queden** | Te marca el producto en amarillo al llegar a ese número |

Mientras escribes los precios, el sistema te dice la ganancia:
*"Ganas Bs. 2.00 por unidad (40% del precio de venta)"*. Y si pones un precio
de venta menor al de compra, te avisa antes de guardar.

Arriba ves **cuánto tienes invertido en mercadería** y **qué se está acabando**.

**Botones:** ✏️ editar · 📦 reponer stock · 🚫 retirar de la venta · 🗑️ eliminar
(solo si nunca se vendió; si ya se vendió, el sistema lo bloquea para no
perder el historial).

> **Reponer stock** tiene dos formas: escribes cuántos **llegaron** y calcula
> el total solo, o escribes directamente el total. Cada cambio queda en la
> bitácora con su motivo.

---

## 🛒 Ventas — caja y administrador

Tal cual lo pediste, sin registrar al cliente:

1. **🛒 Nueva venta**
2. Escribes en el buscador: `agua`
3. Aparecen las opciones con su precio y cuánto queda:
   ```
   Agua 600 ml · Bs. 5.00 · quedan 24
   Agua 1 L    · Bs. 8.00 · quedan 12
   ```
4. Tocas la que quieras → entra a la venta
5. Ajustas la cantidad con **− 2 ＋**
6. **🛒 Vender Bs. 10.00** ← el botón muestra el total y queda fijo abajo

Detalles pensados para que sea rápido:
- Al agregar un producto, el buscador se limpia solo para encadenar varios.
- Si tocas dos veces el mismo producto, suma cantidad.
- Un producto **agotado** aparece pero no se puede tocar.
- Nunca deja vender más de lo que hay, ni en la pantalla ni en la base.

**El cobro entra solo a la caja general**, así que aparece en el Dashboard, en
Pagos y en Reportes sin anotarlo dos veces.

**🚫 Anular** devuelve los productos al stock y quita el cobro.
**🗑️ Eliminar** la borra por completo.

---

## 🔒 Qué ve cada rol

| | Administrador | Cajero | Recepcionista |
|---|---|---|---|
| Vender productos | ✅ | ✅ | ✅ |
| Administrar productos y stock | ✅ | ❌ | ❌ |
| Ver precio de compra y ganancia | ✅ | ❌ | ❌ |

Caja puede cobrar pero **no ve cuánto ganas** ni a cuánto compras: para vender
no lo necesita, y es información del negocio. Si prefieres que sí lo vea,
en `js/app.js`:

```js
verGanancias: ['Administrador'],   // ← agregar 'Cajero'
```

---

## 🏠 Dashboard reorganizado

Fuera la tarjeta de **Horarios programados**. Ahora están:

**Alumnos activos · Ingresos de hoy · Ingresos del mes · Pases del día (hoy) ·
Productos vendidos (hoy) · Pagos pendientes**

Las de pases y productos muestran la cantidad arriba y el dinero abajo.

---

## Comprobado

**En la base de datos**, con Postgres real: vender descuenta el stock y cobra ·
sin stock suficiente lo bloquea con el nombre del producto · anular devuelve
el stock y quita el cobro · reponer deja la bitácora · eliminar un producto ya
vendido se bloquea.

**En el navegador (teléfono)**: tu ejemplo exacto — buscar "agua" da 2
opciones, elegir la de 600 ml, cantidad 2, total Bs. 10.00 y vender. Los 12
módulos cargan sin errores con los dos roles.

---

## Archivos
**Nuevos:** `js/productos.js` · `js/ventas.js` · `supabase/13_productos_y_ventas.sql`
**Modificados:** `js/app.js` · `js/dashboard.js` · `app.html` · `css/estilos.css` · `sw.js` · `index.html`

El menú lateral debe decir **v15**.
