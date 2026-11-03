# Prime Fit · versión 37

**No hay SQL nuevo.** Solo subir la carpeta. Debe decir **v37** abajo.

## WhatsApp para las inscripciones vencidas

En **Inscripciones**, cada inscripción vencida de un alumno que **no renovó**
tiene un botón verde **📲 WhatsApp**. Abre el chat con el mensaje ya escrito.

- **Quien ya renovó** no tiene botón: sale con la etiqueta **Ya renovó**.
- Después de tocarlo, la fila queda marcada **Avisado 01/11/2026** y el botón
  pasa a decir **Reenviar**, para que no le escribas dos veces sin darte cuenta.
- Si el alumno no tiene celular, dice **Sin teléfono** (se agrega en Alumnos).

## Filtro para encontrarlos rápido

Al lado del buscador hay un combo nuevo:
- **Todas**
- **Vigentes**
- **Vencidas sin renovar (N)**: los que hay que llamar. El número dice cuántos son.
- **Todas las vencidas**

## Mensaje

En **Configuración → Aviso de WhatsApp** hay un segundo mensaje, **"para los que
ya vencieron"**, aparte del de "por vencer". Usa {nombre} y {fecha}. Trae este
texto de fábrica:

> Hola {nombre} 👋 Te saludamos de Prime Fit 🥊. Tu mensualidad venció el {fecha}.
> ¡Te esperamos para renovar y seguir entrenando! 💪

## Un detalle

Se marca **Avisado** al tocar el botón, no cuando de verdad envías el mensaje en
WhatsApp. Si abriste el chat y al final no lo mandaste, igual queda como avisado,
pero puedes tocar **Reenviar** cuando quieras.
