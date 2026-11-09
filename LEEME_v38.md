# Prime Fit · versión 38 · corrección

## ⚠️ Pasos para actualizar

1. SQL Editor → **`supabase/24_aviso_por_clase.sql`** → Run.
2. Sube la carpeta. Abajo del menú debe decir **v38**.
   En el teléfono, si sigue diciendo un número viejo, cierra la app y ábrela de nuevo.

## Qué se corrigió

Un alumno inscrito en **dos actividades** no recibía aviso cuando vencía una
de ellas.

**Ejemplo:** Julio tiene Boxeo (vence el 6/11) y Entrenamiento híbrido
(vence el 12/11).

- **Antes:** para saber si alguien "ya renovó", el sistema miraba si tenía
  *cualquier* otra inscripción que terminara después. El Híbrido parecía una
  renovación de Boxeo. Por eso Julio no salió en "Mensualidades por vencer" del
  Dashboard, y en Inscripciones su Boxeo decía "Ya renovó", sin botón de WhatsApp.
- **Ahora:** se mira **clase por clase**. Julio solo "renovó" Boxeo si tiene otra
  inscripción **de Boxeo** que termina después. Su Boxeo vencido sale en naranja,
  con su botón 📲 WhatsApp, y entra en el filtro "Vencidas sin renovar".

Afecta a dos lugares:
- **Dashboard → Mensualidades por vencer** (lo corrige el SQL 24).
- **Inscripciones → botón 📲 y filtro "Vencidas sin renovar"** (lo corrige la carpeta).

Los que ya se te pasaron, como el Boxeo de Julio, aparecen con el filtro
**Vencidas sin renovar**, cada uno con su botón de WhatsApp.
