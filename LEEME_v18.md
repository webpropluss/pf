# Prime Fit · versión 18

Dos cambios: **descripción en los productos** y **buscador de alumno en las inscripciones**.

---

## Paso 1 · Ejecutar el SQL (una sola vez)

En Supabase → **SQL Editor** → pega el contenido de
`supabase/15_descripcion_producto.sql` → **Run**.

Si sale el aviso *"Potential issues detected"*, presiona **Run and enable RLS**,
como siempre.

Ese script hace dos cosas:

1. Agrega el campo **descripción** a los productos.
2. Guarda también la descripción **dentro de cada venta**. Sin esto, una venta
   de dos bucales distintos se leería `2× Bucal Venum, 1× Bucal Venum` en el
   historial y no sabrías cuál fue cuál.

Es seguro ejecutarlo dos veces si te quedas con la duda.

---

## Paso 2 · Subir los archivos a GitHub

Sube la carpeta completa (o solo los archivos cambiados, ver abajo) y espera
1–2 minutos a que GitHub Pages publique.

En el celular, abre la app y revisa que abajo a la izquierda diga **v18**.
Si sigue diciendo v17: cierra la app del todo y vuelve a abrirla.

### Archivos que cambiaron

```
index.html                              (v17 → v18)
app.html                                (v17 → v18)
sw.js                                   (v17 → v18)
css/estilos.css
js/inscripciones.js
js/productos.js
js/ventas.js
supabase/15_descripcion_producto.sql    (nuevo)
```

---

## Qué cambió, en la práctica

### 1 · Descripción de los productos

En **Productos → Nuevo / Editar** hay un campo nuevo **Descripción**, opcional.

Sirve justo para el caso que planteaste: tres bucales Venum a distinto precio.
Ahora en la caja se ven así:

```
🖼  Bucal Venum
    Simple, transparente, con estuche
    Bs. 35.00 · quedan 10

🖼  Bucal Venum
    Doble, para boxeo, gel adaptable
    Bs. 55.00 · quedan 6
```

Además:

- El **buscador de la caja también busca dentro de la descripción**. Escribiendo
  `gel` te sale directo el bucal doble.
- La descripción se ve en la lista de Productos, debajo del nombre.
- Queda guardada en el historial de ventas, así que si mañana cambias la
  descripción del producto, las ventas viejas siguen diciendo lo que se vendió
  ese día.

### 2 · Buscador de alumno en las inscripciones

El combo box con los 100 alumnos ya no está. Ahora:

1. Escribes unas letras del nombre → aparecen las coincidencias (hasta 6).
2. Tocas el alumno → **se queda fijo a la vista**, con su foto, su código y su
   teléfono, y el buscador desaparece.
3. Si te equivocaste, el botón **Cambiar** te devuelve al buscador.

También puedes buscar por **código** (`ALU-011`) o por **teléfono**.

Dos detalles pensados para que no se trabe la caja:

- Si escribiste un nombre y quedó **una sola coincidencia**, al presionar
  *Guardar inscripción* se toma esa sola, sin obligarte a tocarla. Es el mismo
  criterio que ya usa "＋ Agregar clase".
- Si no elegiste a nadie, no te deja guardar y te dice exactamente qué falta,
  en vez de mandar la inscripción sin alumno.

---

## Lo que se probó antes de entregarlo

**Base de datos** (PostgreSQL real, la cadena completa de scripts del 01 al 15):

- El script 15 corre dos veces seguidas sin error.
- Los productos que ya tenías quedan con la descripción vacía, nunca en nulo.
- Una venta de 2 bucales + 1 agua da `Bs. 144.50`, costo `Bs. 77.39`,
  ganancia `Bs. 67.11`, y genera un solo pago por el monto exacto.
- Anular esa venta devuelve el stock igual que antes.
- La numeración de las ventas, el pago que se genera y lo que devuelve la
  función **no cambiaron**: se tocaron únicamente las dos líneas de la
  descripción.

**En el navegador** (36 comprobaciones, pantalla de 320 px y de escritorio):

- El combo box ya no existe; el buscador filtra por nombre, apellido, código y
  teléfono; el alumno elegido se queda puesto y "Cambiar" lo suelta.
- No se puede guardar sin alumno, y con una sola coincidencia se toma sola.
- La inscripción completa sigue funcionando: precio especial de 130 sobre el
  normal de 150, cobro de 130 en el momento.
- Los dos bucales se distinguen en la caja y se encuentran buscando `gel`.
- Nada se sale de la pantalla a 320 px y el botón "Cambiar" mide 44 px de alto.

---

## Un detalle que quedó pendiente de antes

Los permisos por rol (que Caja no vea Disciplinas, Reportes, etc.) siguen siendo
**solo de pantalla**. Alguien con conocimientos técnicos y una cuenta válida
podría consultar esos datos por fuera de la app. Para cerrarlo de verdad hay que
poner reglas por rol en la base de datos (RLS). Cuando quieras lo armamos.
