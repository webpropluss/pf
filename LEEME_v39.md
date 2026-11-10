# Prime Fit · versión 39 · corrección

Incluye la corrección de la v38. Si no subiste la v38, haz los dos pasos.

## ⚠️ Pasos para actualizar

1. Si no lo hiciste: SQL Editor → **`supabase/24_aviso_por_clase.sql`** → Run.
2. Sube la carpeta. Abajo del menú debe decir **v39**.
   Si dice un número viejo, recarga con **Ctrl + F5** (en el teléfono: cierra y
   abre la app).

## Qué se corrigió

Cada disciplina se renueva por su lado.

**Ejemplo:** Julio tiene Híbrido vigente hasta el 12/11 y su Boxeo venció el 6/11.

1. **Lista de Inscripciones** (v38): el Boxeo de Julio sale **Vencida**, ya no
   "Ya renovó", y tiene su botón 📲 WhatsApp.
2. **Avisos por vencer del Dashboard** (SQL 24): avisan cada disciplina por separado.
3. **Nueva inscripción** (v39): el aviso azul "🔁 Ya tiene … vigente" sale solo
   cuando eliges una disciplina que el alumno **todavía tiene vigente**, y dice cuál es:
   *"Ya tiene Boxeo vigente hasta el 12/11. Para renovarla, la nueva empieza el 13/11"*.
   Si inscribes a Julio en Boxeo, no sale ningún aviso: su Boxeo ya venció y la
   nueva puede empezar hoy.

Antes, el aviso salía apenas elegías al alumno y miraba cualquier mensualidad suya.
