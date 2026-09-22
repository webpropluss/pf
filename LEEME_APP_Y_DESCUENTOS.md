# 📱 App instalable + 💸 Precio con descuento

Dos cambios nuevos en Prime Fit.

---

## 1) Precio especial por disciplina (descuento)

### Qué hace
Al inscribir a un alumno, el precio de la disciplina se carga solo, **pero ahora
se puede cambiar**. Sirve para promociones como la de inauguración: el precio
normal es Bs. 150 y le cobras Bs. 130.

El sistema guarda **los dos precios**, así queda registrado cuánto descuento le
hiciste a cada alumno.

### Cómo se usa
1. Inscripciones → **＋ Nueva inscripción**.
2. Eliges la disciplina → el campo **Precio Bs.** se llena con el precio normal.
3. Lo cambias a lo que le vas a cobrar (ej. `130`) y eliges el horario.
4. Presionas **＋**.

En la tabla verás el precio normal tachado, lo que se le cobra, y una etiqueta
verde con el descuento (`−Bs. 20.00`). El total de abajo también lo detalla.

> Si le pones un precio **mayor** al normal, el sistema te pregunta antes de
> aceptarlo, para evitar errores de tipeo.

### Los dos descuentos no son lo mismo
| Campo | Para qué sirve |
|---|---|
| **Precio Bs.** (arriba, por disciplina) | Precio especial de esa clase. Queda guardado como descuento. |
| **Descuento (Bs.)** (abajo, general) | Rebaja suelta sobre el total de toda la inscripción. |

### ⚠ Hay que ejecutar un SQL
En Supabase → **SQL Editor → New query** → pega
`supabase/07_precio_con_descuento.sql` → **Run**.
Si sale el aviso, elige **"Run and enable RLS"**.

Sin ese paso el sistema igual funciona, pero no guarda el precio normal y no
podrás ver cuánto descuento diste.

### Dónde ves los descuentos
En **Reportes** hay una tarjeta nueva: **Descuentos otorgados**, con el total
regalado en el rango de fechas que elijas. Ideal para medir la promoción de
inauguración.

---

## 2) Instalar la app en el celular (PWA)

### Qué hace
Prime Fit se puede instalar como una app: queda con su **ícono en la pantalla
de inicio** y abre **a pantalla completa**, sin la barra del navegador arriba.

### ⚠ Requisito: el sitio debe estar publicado con HTTPS
Esto **no funciona abriendo los archivos con doble clic** ni con Live Server
desde otro dispositivo. Para instalarlo en el celular, el sitio tiene que estar
subido a **Vercel**, **Netlify** o **GitHub Pages** (todos dan HTTPS gratis).

Mientras tanto puedes probarlo en la misma computadora con Live Server
(`localhost` también cuenta como seguro).

### Cómo se instala

**Android (Chrome):**
Al entrar al sitio aparece abajo a la derecha un botón rojo **⬇ Instalar app**.
Lo tocas y listo. (También sirve el menú ⋮ → *Instalar aplicación*.)

**iPhone / iPad (Safari):**
Safari no tiene botón de instalación. La primera vez te aparece un aviso
recordándotelo. Los pasos son:
Botón **Compartir** ⬆ → **Añadir a pantalla de inicio** → **Añadir**.

> Debe abrirse en **Safari**, no en Chrome, para que se pueda instalar.

**Computadora (Chrome/Edge):**
Aparece un ícono de instalación ⊕ en la barra de direcciones.

### Funciona sin internet (a medias)
Si te quedas sin señal, la app **abre igual** (queda guardada en el celular),
pero no podrá mostrar ni guardar datos, porque esos viven en Supabase.
Al volver el internet, todo normal.

### ⚠ Importante al subir cambios al sitio
Cuando modifiques el sistema y lo subas, abre `sw.js` y **sube el número de
versión**:

```js
const VERSION = 'primefit-v1';   →   'primefit-v2'
```

Sin eso, los celulares que ya tienen la app instalada pueden seguir viendo la
versión anterior por un tiempo.

---

## Archivos nuevos y modificados

**Nuevos**
- `manifest.json` — datos de la app (nombre, ícono, pantalla completa)
- `sw.js` — service worker (permite instalar y abrir sin internet)
- `js/pwa.js` — botón de instalación y aviso para iPhone
- `img/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`
- `supabase/07_precio_con_descuento.sql` — ⚠ hay que ejecutarlo

**Modificados**
- `index.html`, `app.html` — enlaces del manifest e íconos
- `css/estilos.css` — estilos de instalación + acomodo del nuevo campo de precio
- `js/inscripciones.js` — campo de precio editable y cálculo del descuento
- `js/reportes.js` — tarjeta "Descuentos otorgados"
- `js/alumnos.js` — ya viene sin el campo de email
