# 💰 Precios con centavos (3.83)

## Qué pasaba

Los campos de dinero estaban puestos para aceptar solo **múltiplos de 0.50**
(3.00, 3.50, 4.00…). Al escribir **3.83** el navegador lo consideraba inválido
y **bloqueaba el guardado sin decir nada claro**. Por eso no se te registraban
los productos.

Fue un descuido mío: puse ese paso pensando en precios redondos de
mensualidad, sin considerar los precios de proveedor.

## Cómo quedó

Los **10 campos de dinero** del sistema ahora aceptan centavos:

| Dónde | Campo |
|---|---|
| Productos | precio de compra · precio de venta |
| Ventas | descuento |
| Disciplinas | precio mensual |
| Inscripciones | precio especial · descuento · paga ahora |
| Pases del día | monto |
| Pagos | monto a cobrar |
| Configuración | precio sugerido del pase |

**No hay SQL que ejecutar**: la base de datos ya guardaba 2 decimales
(`numeric(10,2)`) desde el principio. El único bloqueo estaba en el formulario.

---

## Comprobado

**En el formulario**: producto con compra **3.83** y venta **6.50** → se guarda,
y calcula bien: *"Ganas Bs. 2.67 por unidad (41%)"*.

**En la base, que es donde un redondeo mal hecho dolería:**

| Caso | Resultado |
|---|---|
| Vender 3 × 6.50 (compra 3.83) | subtotal 19.50 · costo 11.49 · **ganancia 8.01** ✓ |
| Vender 2 con descuento 2.35 | 13.00 − 2.35 = **10.65** · ganancia 2.99 ✓ |
| Lo cobrado vs. el total | coinciden exactamente ✓ |
| Precio con 3 decimales (3.836) | se redondea a **3.84**, no se rompe ✓ |

---

## Archivos modificados
`js/productos.js` · `js/ventas.js` · `js/catalogos.js` · `js/inscripciones.js` ·
`js/pases.js` · `js/pagos.js` · `js/usuarios_config.js` ·
`index.html`, `app.html` — `?v=17` · `sw.js` — `primefit-v17`

El menú lateral debe decir **v17**.
