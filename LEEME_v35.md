# Prime Fit · versión 35

Los cupos se cuentan por **alumnos con inscripción vigente**, las vencidas
salen en **naranja** y se puede **renovar sin anular**.

## ⚠️ Pasos para actualizar

Si todavía no instalaste la v34, primero ejecuta sus SQL (21 y 22).

1. SQL Editor → **`supabase/23_cupos_por_alumno.sql`** → Run.
   Al final muestra cada horario con sus lugares **ocupados**, ya corregidos.
2. Sube la carpeta. Abajo del menú debe decir **v35**.

## Qué cambió

### Cupos
- **Antes:** cada inscripción sumaba 1 al horario y solo restaba si se anulaba.
  Las vencidas seguían ocupando lugar, y quien renovaba ocupaba dos.
- **Ahora:** un lugar ocupado = **un alumno** con inscripción vigente (no vencida
  ni anulada) en esa clase. Si renueva, sigue ocupando uno solo. Si no renueva,
  su lugar se libera solo al día siguiente de su vencimiento.
- En Horarios la columna ahora se llama **Ocupados**.
- Al ejecutar el SQL se corrigen todos los contadores inflados.

### Renovar
- Al elegir un alumno que tiene una mensualidad vigente aparece:
  *"Tiene mensualidad vigente hasta el 16/11. Para renovar, la nueva empieza el 17/11"*
  con un botón que pone las fechas.
- Su horario aparece habilitado aunque la clase esté llena (*"ya tiene su lugar"*).
- Si las fechas se cruzan con su inscripción actual, el sistema dice desde qué día
  puede empezar la nueva.

### Lista de inscripciones
- Las **vencidas** salen en naranja con la etiqueta **Vencida**. Siguen
  mostrando si se pagó: es historial, no hay que tocarlas.
- Las que empiezan más adelante dicen **"Empieza el …"**.
- El botón 🚫 Anular ya **no aparece en las vencidas**.

### ¿Para qué queda "Anular"?
Solo para dos casos: **te equivocaste** al registrarla, o el alumno **se retiró
antes de que venza** y quieres liberar su lugar ya. El pago se conserva.

### Avisos de WhatsApp
"Mensualidades por vencer" del Dashboard ya **no avisa a quien ya renovó**.

### Hora de Bolivia
"Hoy" para los cupos se calcula en hora de Bolivia. La base corre en hora de
Londres: sin esto, desde las 20:00 creería que ya es el día siguiente.
