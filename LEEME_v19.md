# Prime Fit · versión 19

Se arregla el stock: no es que no se pudiera cambiar, es que estaba escondido.

**No hace falta ejecutar nada en Supabase.** Solo subir los archivos.

```
index.html          (v18 → v19)
app.html            (v18 → v19)
sw.js               (v18 → v19)
css/estilos.css
js/productos.js
```

Revisa que abajo a la izquierda diga **v19**.

---

## Qué pasaba

Sí se podía reponer stock, con el botón **📦**. El problema es que en el teléfono
los cuatro botones eran solo dibujitos: ✏️ 📦 🚫 🗑️. En la computadora, dejando
el mouse encima, aparece un cartelito que dice qué hace cada uno — pero **en el
celular ese cartelito no existe**, porque no hay mouse. Así que había que
adivinar.

Y encima, al entrar por ✏️ *Editar* (que es lo lógico), el campo de stock
aparecía gris y bloqueado, sin decir por qué ni a dónde ir. Cualquiera concluye
lo que concluiste: que no se puede.

---

## Qué cambió

**1 · Los botones ahora dicen qué hacen.** En el teléfono se lee:

```
✏️ Editar     📦 Stock
🚫 Retirar    🗑️ Eliminar
```

**2 · En Editar producto ya no hay campo bloqueado.** Ahora dice cuántas hay y
te lleva directo:

```
STOCK
┌──────────────────────────────────┐
│ Ahora hay 10 unidades            │
│ [ 📦 Reponer o corregir ]        │
└──────────────────────────────────┘
```

Si habías escrito cambios en el producto, te avisa antes de pasar, para que no
se pierdan.

**3 · La pantalla de stock quedó más clara:**

- **¿Cuántas llegaron?** → el caso tuyo: compraste 12 más, pones 12 y se suman.
- **O deja el total exacto en** → para cuando contaste y no cuadra, o se rompió algo.
- Abajo se ve cómo queda antes de guardar: **22 · entran 12 · antes había 10**.

---

## Por qué el stock se cambia en su propia pantalla

No es un capricho del programa. Cada movimiento queda anotado con su motivo:

| Movimiento | Cantidad | Queda | Motivo |
|---|---|---|---|
| compra | +12 | 22 | Llegó pedido del proveedor |
| venta | −3 | 19 | Venta al cliente |
| ajuste | −2 | 17 | Se rompieron 2 |

Si el stock se pudiera pisar a mano desde el formulario del producto, ese
registro se rompería y en unos meses no habría forma de saber si faltan unidades
porque se vendieron, porque se rompieron o porque alguien se las llevó. Con esto
siempre se puede reconstruir de dónde salió cada unidad.

---

## Lo que se probó

**Base de datos** (PostgreSQL real): sumar 12 deja el stock en 22 y registra el
movimiento como `compra`; bajar a 20 lo registra como `ajuste` de −2; un stock
negativo se rechaza con un mensaje claro.

**En el navegador** (22 comprobaciones, 390 px y 320 px):

- Los cuatro botones se leen con todas sus letras.
- En Editar ya no existe el campo de stock bloqueado; el botón lleva de verdad
  a la pantalla de stock y avisa si había cambios sin guardar.
- 10 + 12 = 22, con el aviso "entran 12 · antes había 10"; bajar a 8 avisa
  "salen 2".
- **Guardar el producto no toca el stock**: el guardado no manda ese dato, así
  que editar un precio no puede pisar las unidades por accidente.
- En producto nuevo sí se escribe el stock inicial, y se guarda.
- Nada se sale de la pantalla a 320 px y los botones miden 44 px de alto.

Se volvió a correr también la prueba de la v18 (buscador de alumno y
descripción de productos): sigue todo bien.

---

## Una cosa que quedó pendiente

Los botones rotulados los puse **solo en Productos**, que es donde te trabaste.
En Alumnos, Inscripciones y Ventas los botones siguen siendo dibujitos sueltos y
tienen el mismo problema. Si quieres se los pongo a todos y queda parejo — son
unos minutos.
