# ✅ Módulo Asistencia eliminado

## Qué se quitó

- **Asistencia** ya no está en el menú de ningún rol.
- Se eliminó el archivo `js/asistencia.js`.
- En **Reportes** desapareció la tarjeta *"Asistencias registradas"*.
- El sistema ya no carga nada relacionado con pasar lista.

El menú quedó así:

| Rol | Módulos |
|---|---|
| **Administrador** | Dashboard · Alumnos · Disciplinas · Horarios · Instructores · Inscripciones · Pagos · Pases del día · Reportes · Usuarios · Configuración |
| **Cajero** | Dashboard · Alumnos · Inscripciones · Pagos · Pases del día |
| **Recepcionista** | Todo menos Usuarios y Configuración |

---

## Lo que NO se tocó, y por qué

**La tabla `asistencias` sigue en la base de datos.** No es un descuido:

- Varias funciones del sistema la consultan (al eliminar un alumno o un
  horario, para avisarte qué se va a borrar). Si la elimino, esas funciones
  dejan de funcionar y habría que reescribir cuatro de ellas.
- Una tabla vacía **no ocupa espacio ni hace más lento nada**.
- Si algún día cambias de idea, el módulo se puede reactivar sin tocar la base.

Si quieres borrar los registros de prueba que hayan quedado, hay un script
**opcional**: `supabase/12_quitar_asistencia.sql`. No es necesario ejecutarlo.

---

## Si algún día lo quieres de vuelta

Avísame y lo reactivo: el archivo se puede restaurar y solo hay que volver a
ponerlo en el menú. La estructura de la base sigue intacta, así que no se
perdería nada.

---

## Comprobado
Con Administrador y con Caja: el menú ya no muestra Asistencia, ningún
archivo da error 404, y **los 11 módulos restantes cargan sin errores**.

---

## Archivos modificados
- `app.html` — sin el menú ni el script
- `js/app.js` — sin el módulo registrado
- `js/reportes.js` — sin la tarjeta de asistencias
- `js/asistencia.js` — **eliminado**
- `sw.js` — `primefit-v14` · `index.html`, `app.html` — `?v=14`

El menú lateral debe decir **v14**.
