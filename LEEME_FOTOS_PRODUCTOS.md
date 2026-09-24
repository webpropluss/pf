# 📷 Fotos de productos (comprimidas)

## ⚠ Ejecutar el SQL
`supabase/14_fotos_productos.sql` en el SQL Editor → **Run**.
Agrega la columna de la foto y crea el depósito `fotos-productos`.

---

## Cuánto comprime

Medido con fotos del tamaño que realmente saca un celular:

| Foto original | Queda en | Reducción | Tiempo |
|---|---|---|---|
| 12 MP horizontal (1.2 MB) | **29 KB** | −98% | 60 ms |
| 12 MP vertical (1.2 MB) | **33 KB** | −97% | 124 ms |
| Foto chica (462 KB) | **49 KB** | −89% | 47 ms |

La compresión ocurre **en el teléfono, antes de subir**: se achica a 500 px de
lado y se guarda en WebP (o JPEG si el navegador es viejo). Sube poco y carga
rápido incluso con mala señal.

Con ~40 KB por foto, en el **1 GB gratis de Supabase caben más de 20.000
fotos**. No vas a tener problema de espacio.

---

## Dónde se ve la foto

**En el buscador de ventas** — que es para lo que la pediste:

```
🔍 bucal
┌────┬──────────────────────────────┐
│ 🖼️ │ Bucal Venum simple           │
│    │ Bs. 25.00 · quedan 8         │
├────┼──────────────────────────────┤
│ 🖼️ │ Bucal Venum doble            │
│    │ Bs. 40.00 · quedan 5         │
├────┼──────────────────────────────┤
│ 🖼️ │ Bucal Venum gel              │
│    │ Bs. 55.00 · quedan 3         │
└────┴──────────────────────────────┘
```

También en la **lista de Productos** y en las **líneas de la venta**, para
confirmar que agregaste el correcto. Los productos sin foto muestran un 📦.

## Al cargar la foto

En el formulario del producto ves la **vista previa** y cuánto va a pesar:

> *Se subirá comprimida: **31 KB** (la original pesa 1203 KB)*

- Si cambias la foto, **la anterior se borra sola** del servidor.
- Hay una casilla **"Quitar la foto actual"** si prefieres dejarlo sin foto.
- Al eliminar el producto, su foto también se borra.

---

## De paso: las fotos de alumnos también se comprimen

Antes se subían **tal cual**, o sea que una foto de 3 MB ocupaba 3 MB. Eso era
un descuido mío que iba a llenarte el espacio rápido. Ahora pasan por el mismo
compresor (400 px, que es de sobra para el avatar).

> Las fotos de alumnos que ya subiste siguen pesando lo que pesaban. Si
> quieres, se pueden volver a cargar para que se compriman; o déjalas, no
> molestan.

---

## Archivos
**Nuevo:** `supabase/14_fotos_productos.sql`
**Modificados:** `js/ui.js` (el compresor) · `js/productos.js` · `js/ventas.js` ·
`js/alumnos.js` · `css/estilos.css` · `app.html` · `index.html` · `sw.js`

El menú lateral debe decir **v16**.
