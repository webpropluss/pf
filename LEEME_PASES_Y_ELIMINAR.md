# 🎟️ Pases del día · ficha simplificada · eliminar registros

Cuatro cambios nuevos.

---

## ⚠ Primero: ejecutar el SQL

En Supabase → **SQL Editor → New query** → pega
`supabase/08_pases_dia_y_eliminar.sql` → **Run**, y después
`supabase/09_eliminar_catalogos.sql` → **Run**.
Si sale el aviso, elige **"Run and enable RLS"**.

Sin este paso el módulo de Pases del día y el botón de eliminar no funcionan.

> Ese script **borra las columnas CI y dirección** de la tabla de alumnos.
> Si quisieras conservar esos datos viejos, comenta las dos últimas líneas
> antes de ejecutarlo (dejarlas no rompe nada, solo quedan sin usarse).

---

## 1) Ficha del alumno más corta

Ya no se piden **CI/DNI** ni **dirección**. La ficha quedó así:

| Campo | |
|---|---|
| Nombre completo | obligatorio |
| Teléfono (WhatsApp) | **obligatorio** — es al que se le manda el aviso de vencimiento |
| Fecha de nacimiento | opcional |
| Foto | opcional |

El teléfono quedó obligatorio a propósito: sin él, el alumno nunca recibiría
el aviso antes de que venza su mes, que es justamente para lo que se hizo el
sistema. La fecha de nacimiento sí es opcional, para quien no quiera darla.

---

## 2) 🎟️ Pases del día

Módulo nuevo en el menú, para la gente que paga y entrena **un solo día**, sin
mensualidad.

### Cómo se registra
1. Menú → **Pases del día** → **＋ Nuevo pase del día**.
2. Eliges quién entrena:
   - **Visitante nuevo** → escribes su nombre y teléfono. Queda guardado como
     alumno, así después puedes invitarlo a sacar mensualidad.
   - O eliges un **alumno ya registrado** de la lista.
3. Pones la **fecha**, el **monto** (viene con el precio sugerido) y, si
   quieres, la **clase/horario**. También puede quedar como entrada libre.
4. Método de pago y una observación opcional.

### Lo que hace por detrás
- El cobro se registra como un **pago normal**, así que aparece solo en
  **Dashboard**, en **Pagos** y en **Reportes**. No hay que anotarlo dos veces.
- Si le asignaste una clase, esa persona **aparece al pasar lista** en
  Asistencia ese día, marcada con una etiqueta amarilla "Pase del día".
- Los pases **no ocupan cupo** de la clase, porque son ocasionales.

### El precio sugerido
Se configura en **Configuración → Precio sugerido del pase del día**
(viene en Bs. 25). Es solo el valor que aparece por defecto; en cada pase lo
puedes cambiar.

### Para borrar un pase
Se elimina desde el mismo módulo con 🗑️, y se borra también su cobro.
En la pantalla de Pagos esos cobros muestran un 🎟️ en vez del botón de
eliminar, justamente para que se borren desde un solo lugar.

---

## 3) 🗑️ Eliminar alumnos de verdad

En la lista de alumnos ahora hay **dos botones distintos**, y conviene tener
clara la diferencia:

| Botón | Qué hace | Cuándo usarlo |
|---|---|---|
| 🚫 **Dar de baja** | Lo marca como inactivo. **Guarda todo su historial** y se puede reactivar. | El alumno deja de venir pero podría volver. Sus pagos siguen en los reportes. |
| 🗑️ **Eliminar** | Lo **borra para siempre**, junto con su historial. No se recupera. | Datos de prueba, o alguien cargado por error. |

### Protecciones que tiene
- Si el alumno **no tiene ningún movimiento**, pide una confirmación simple.
- Si **sí tiene historial**, te muestra exactamente qué se va a borrar
  (inscripciones, pagos, asistencias, pases) y pide **dos confirmaciones**.
- Al eliminarlo, **las plazas que ocupaba en las clases quedan libres**
  automáticamente, y queda anotado en la bitácora de movimientos.
- También se borra su foto del almacenamiento.

---

## 4) 🗑️ Eliminar disciplinas, horarios e instructores

También se pueden eliminar, pero con una **protección importante**: el sistema
**bloquea el borrado cuando hay historial de dinero de por medio**, porque eso
te descuadraría los reportes. En vez de borrar a medias, te dice exactamente
qué hay que quitar primero.

### ⚠ Ejecutar el SQL
`supabase/09_eliminar_catalogos.sql` en el SQL Editor → **Run**.

### Qué bloquea cada uno

| Quieres eliminar | Se bloquea si… | Qué pasa si sí se puede |
|---|---|---|
| **Disciplina** | tiene horarios, o aparece en alguna inscripción | se borra |
| **Horario** | tiene inscripciones | se borra junto con sus asistencias y su bitácora; los pases de ese día quedan como "entrada libre" |
| **Instructor** | está asignado a alguna clase | se borra |
| **Inscripción** | nunca se bloquea (es el punto de partida) | se borran sus pagos y las plazas quedan libres |

### El orden para limpiar datos de prueba
Como las cosas dependen unas de otras, hay que ir de adentro hacia afuera:

```
1. Inscripciones   →  2. Horarios  →  3. Disciplinas / Instructores
```

Si intentas saltarte un paso, el sistema te avisa con un mensaje que dice
cuántos registros lo están usando.

### Inscripciones: anular vs. eliminar
En el módulo Inscripciones ahora hay dos botones (solo para administrador):

| Botón | Qué hace |
|---|---|
| 🚫 **Anular** | Libera las plazas pero **la inscripción queda registrada** como anulada. Es lo correcto para una baja real. |
| 🗑️ **Eliminar** | La **borra por completo**, con sus pagos. Desaparece de los reportes. Para datos de prueba. |

> Antes el botón de anular era 🗑️; ahora es 🚫, y 🗑️ es el de borrado
> definitivo. Es el mismo criterio en todos los módulos: **🚫 se puede
> deshacer, 🗑️ no**.

---

## Archivos nuevos y modificados

**Nuevos**
- `js/pases.js` — módulo de pases del día
- `supabase/08_pases_dia_y_eliminar.sql` — ⚠ hay que ejecutarlo
- `supabase/09_eliminar_catalogos.sql` — ⚠ hay que ejecutarlo

**Modificados**
- `js/alumnos.js` — ficha simplificada y botón de eliminar
- `js/asistencia.js` — los pases del día aparecen al pasar lista
- `js/pagos.js` — los cobros de pases se gestionan desde su módulo
- `js/usuarios_config.js` — precio sugerido del pase
- `js/catalogos.js`, `js/horarios.js`, `js/inscripciones.js` — botones de eliminar
- `js/app.js`, `app.html` — módulo nuevo en el menú
- `sw.js` — versión subida a `primefit-v3`

---

## Al subir esto a GitHub Pages

Ya está hecho lo de subir la versión del service worker (`primefit-v3`), así
que los celulares que tengan la app instalada van a tomar la versión nueva
sola. Solo recuerda hacer `git add . && git commit && git push`.
