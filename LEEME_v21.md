# Prime Fit · versión 21

Productos de regalo: sale del stock, **no** entra como ingreso, se anota como
gasto promocional.

> Esta versión incluye también todo lo de la **v20** (filtro de fechas del
> dashboard y fecha del cobro), que todavía no habías subido. Ejecuta los dos
> SQL en orden: primero el 16, después el 17.

---

## Paso 1 · Ejecutar el SQL, en este orden

Supabase → SQL Editor. Si sale *"Potential issues detected"*, **Run and enable RLS**.

1. `supabase/16_fecha_cobro.sql` ← el de la v20, si no lo ejecutaste
2. `supabase/17_promociones.sql` ← el nuevo

## Paso 2 · Subir los archivos

```
index.html   app.html   sw.js        (→ v21)
css/estilos.css
js/app.js            ← el módulo nuevo y los permisos
js/dashboard.js      ← tarjeta de gasto promocional
js/promociones.js    ← NUEVO
js/ventas.js
js/inscripciones.js  ← de la v20
supabase/16_fecha_cobro.sql
supabase/17_promociones.sql
```

Confirma que abajo diga **v21**.

---

## Cómo funciona

Módulo nuevo **🎁 Promociones**. Tocas *Registrar regalo*, pones el motivo
(Inauguración, Sorteo, Dinámica de redes… hay una lista sugerida), buscas los
productos igual que en una venta, y listo.

La diferencia con una venta es una sola, pero es la importante: **no se crea
ningún pago**. Por eso el regalo no aparece como ingreso en el Dashboard, ni en
Reportes, ni en ningún total de caja.

Lo que sí pasa:

- **El stock baja**, igual que en una venta.
- Queda en la bitácora de stock como movimiento de tipo `promocion`, así que
  después siempre se puede reconstruir por qué faltan unidades.
- Se guardan **dos números** por cada regalo:

| | Qué es | Para qué |
|---|---|---|
| **Costo** | Lo que te costó al proveedor | Es el gasto de verdad, la plata que saliste perdiendo |
| **Valor de venta** | Lo que habrías cobrado | Para decir "regalamos Bs. 500 en productos" |

En el buscador del regalo se muestra el **precio de compra**, no el de venta:
cuando regalas, lo que te importa es cuánto te cuesta.

### En el dashboard

Tarjeta nueva **Gasto promocional**, que respeta el filtro de fechas que hicimos
en la v20. Muestra el costo, cuántos artículos se regalaron y el valor de venta.

### Historial

El módulo tiene tres tarjetas (regalado hoy, gasto del mes, valor de venta del
mes) y la lista completa con motivo, a quién se entregó, qué productos, costo,
valor y quién lo registró.

Se puede **cargar un evento de otro día**: el formulario trae un campo de fecha.

---

## Una decisión que tomé sobre permisos

**Caja SÍ puede registrar regalos**, porque en una inauguración es quien los
entrega; si no lo pudiera anotar, el stock se te descuadraría igual.

**Caja NO puede anular ni eliminar** un regalo. Registrar una salida de
mercadería y después borrarla es la forma más simple de que desaparezca stock
sin dejar rastro, y no quise dejar esa puerta abierta sin avisarte. Eso es solo
del administrador.

Si prefieres que caja también pueda deshacerlos, es una línea en `js/app.js`:
agrega `'Cajero'` a `anularPromo`. Está comentada ahí mismo.

Aun así, conviene que **mires el historial de vez en cuando**: es una salida de
mercadería sin dinero de por medio, y cada registro dice quién lo hizo.

---

## Lo que se probó

**Base de datos** (cadena completa 01→17 en PostgreSQL real, y el 17 dos veces):

- Inauguración con 1 proteína + 30 alfajores → costo **Bs. 294.90**, valor de
  venta **Bs. 475.00**.
- **Los ingresos quedaron en cero y no se creó ningún pago.** Esa es la prueba
  que importa y la verifiqué explícitamente antes y después.
- El stock bajó de 10→9 y de 100→70, con su movimiento `promocion` anotado.
- No deja regalar más de lo que hay.
- Anular devuelve el stock y pone el gasto en cero; eliminar también devuelve el
  stock y no deja movimientos huérfanos.
- El correlativo por día funciona, incluso cargando un evento de hace 20 días.
- Ya no deja borrar un producto que se regaló alguna vez (antes solo miraba las
  ventas, así que se habría podido perder el historial del gasto).

**En el navegador** (25 comprobaciones, 390 y 320 px) y **permisos** (11
comprobaciones contra el `app.js` real, no una copia):

- El dashboard muestra Bs. 294.90 de gasto y los ingresos **no se mueven**.
- El gasto respeta el filtro de fechas.
- Caja ve el módulo pero no le aparecen los botones de anular/eliminar.
- No se rompió ningún permiso de antes.

Las cinco suites anteriores (v18, v19, v20) siguen pasando.

---

## Dos cosas más

**Arreglé un desborde que también estaba en Ventas.** Al poner los productos en
varias líneas dentro de una celda, en el teléfono se salían 37 px de la
pantalla. Lo encontré probando Promociones, pero venía de la v18 en Ventas;
quedó corregido en los dos.

**Quité un número equivocado.** Al registrar una venta el aviso decía
"Venta N° 47" usando el id interno, que no coincide con el N° que muestra la
lista. Ahora dice solo "Venta registrada · Bs. X cobrados".

**Reportes todavía no incluye el gasto promocional.** Si quieres que ahí
aparezca un resumen de lo regalado junto a las ventas, lo agrego.
