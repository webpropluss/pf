# 📱 Responsive corregido — y por qué antes no se veía

## Lo que pasaba

En tu captura, la versión que tenías en el teléfono era la **anterior**: las
tarjetas se salían por la derecha y la tabla seguía siendo tabla. El
JavaScript sí se había actualizado (por eso el deslizamiento ya funcionaba),
pero **el archivo `css/estilos.css` seguía siendo el viejo**, guardado en la
caché del navegador.

Se corrigió por tres lados, para que no vuelva a pasar:

### 1. El diseño ya no depende del JavaScript
Antes, las tablas se convertían en tarjetas solo si el JavaScript alcanzaba a
etiquetarlas. Ahora **el CSS solo ya hace todo el trabajo**: cualquier tabla,
en cualquier módulo, se muestra como tarjetas en pantalla chica. Las etiquetas
(NOMBRE, TELÉFONO…) son un extra que agrega el JavaScript encima.

Probado a propósito con el JavaScript desactivado: **0 px de desplazamiento
lateral igual**.

### 2. Los archivos llevan número de versión
Ahora el HTML pide `css/estilos.css?v=5` en vez de `css/estilos.css`. Para el
navegador es una dirección distinta, así que **está obligado a bajarla de
nuevo**. Nunca más va a servir la hoja de estilos vieja.

> ⚠ **Cada vez que subas cambios**, sube ese número en `index.html` y
> `app.html` (`?v=5` → `?v=6`) y también en `sw.js` (`primefit-v5` → `v6`).

### 3. El service worker ya no acepta copias viejas del navegador
Ahora pide los archivos con `cache: 'reload'`, que salta la caché propia del
navegador.

---

## Qué se ve ahora en el teléfono

- **Tarjetas de resumen**: dos por fila en vez de una gigante por fila.
- **Todas las tablas** (alumnos, instructores, disciplinas, horarios, pagos,
  pases, inscripciones, reportes, asistencia, usuarios) se ven como tarjetas,
  con cada dato y su etiqueta, uno debajo del otro.
- **Botones de acción** grandes y agrupados al pie de cada tarjeta.
- **Cero desplazamiento lateral**, medido en 320, 390 y 412 px de ancho.

En la computadora todo sigue viéndose como tablas normales.

---

## 👀 Cómo confirmar que tu celular tomó la versión nueva

Abajo del botón **Cerrar sesión**, en el menú lateral, ahora aparece un
pequeño **`v5`**.

- Si ves **v5** → tienes la versión nueva. ✅
- Si no ves nada ahí → el celular sigue con la anterior.

### Si sigue sin actualizarse
1. Publica los archivos y espera 1–2 minutos (GitHub Pages tarda un poco).
2. En el celular, cierra la app por completo y vuelve a abrirla.
3. Si aún así no cambia: desinstala la app de la pantalla de inicio, abre el
   sitio en el navegador, y vuelve a instalarla.

---

## Archivos modificados
- `css/estilos.css` — tarjetas sin depender del JavaScript + indicador de versión
- `index.html`, `app.html` — `?v=5` en todos los archivos, indicador de versión
- `sw.js` — `primefit-v5`, sin caché vieja del navegador

**No hay SQL que ejecutar.**
