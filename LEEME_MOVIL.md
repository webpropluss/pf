# 📱 Arreglos del teléfono

## 1) Deslizar hacia atrás ya no cierra la sesión

**Qué pasaba:** el gesto de deslizar (y el botón ← del teléfono) hacía que el
navegador retrocediera de `app.html` a la pantalla de login. Parecía que se
había cerrado la sesión, aunque en realidad seguía abierta.

**Cómo quedó:** el gesto ahora navega *dentro* de la aplicación, como en una
app normal:

1. Si hay un formulario abierto → lo cierra.
2. Si el menú lateral está abierto → lo cierra.
3. Si no → vuelve al módulo anterior.
4. Si ya está en el Dashboard → se queda ahí.

**Nunca sale al login.** Para salir está el botón **Cerrar sesión**, que ahora
además pide confirmación para que no se toque sin querer.

También se arregló el historial: al entrar, la pantalla de login se
*reemplaza* en vez de apilarse, así que ya no queda "detrás" de la aplicación.

---

## 2) Las tablas ya no se desplazan de lado

**Qué pasaba:** en el teléfono las tablas eran demasiado anchas y había que
arrastrarlas de lado para ver las columnas. Molesto e incómodo.

**Cómo quedó:** en pantallas chicas cada fila se convierte en una **tarjeta**
con sus datos uno debajo de otro, cada uno con su etiqueta:

```
┌──────────────────────────────┐
│  (MF)                        │
│  NOMBRE      María Fernández │
│  TELÉFONO      59176000001   │
│  EDAD               28 años  │
│  ESTADO              Activo  │
│  ─────────────────────────   │
│              ✏️   🚫   🗑️    │
└──────────────────────────────┘
```

Medido en tres tamaños de teléfono (320, 390 y 412 px de ancho):
**0 px de desplazamiento lateral** en todos los módulos y formularios.

En la computadora las tablas siguen viéndose como tablas normales.

### Funciona en todos los módulos, también en los futuros
No se tocó cada pantalla una por una: hay una función que lee los títulos de
cada tabla y se los pega a las celdas automáticamente. Cualquier tabla nueva
que se agregue después se adapta sola.

### Otros ajustes del teléfono
- Botones de acción más grandes, fáciles de tocar con el dedo.
- Campos de texto con letra de 16 px, que es lo que evita que el iPhone haga
  zoom solo al escribir.
- Encabezados y tarjetas más compactos en pantallas muy angostas.
- El aviso de "instalar la app" ya no tapa los formularios.

---

## Archivos modificados
- `css/estilos.css` — tablas como tarjetas y ajustes de teléfono
- `js/ui.js` — adaptador automático de tablas
- `js/app.js` — manejo del gesto "atrás"
- `js/auth.js`, `index.html` — historial y confirmación al cerrar sesión
- `sw.js` — versión subida a `primefit-v4`

No hay ningún SQL nuevo que ejecutar. Solo subir los archivos.
