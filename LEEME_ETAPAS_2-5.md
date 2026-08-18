# 🥊 Prime Fit Web — Etapas 2, 3, 4 y 5 (sistema completo)

Continuación de la Etapa 1. El sistema ya está **completo**: todos los módulos del
sistema local + la automatización de WhatsApp.

---

## ✅ Qué se agregó en cada etapa

### Etapa 2 — Catálogos
| Módulo | Archivo | Detalle |
|---|---|---|
| Alumnos | `js/alumnos.js` | Alta/edición/baja con **foto subida a Supabase Storage** (bucket `fotos-alumnos`), buscador, edad calculada, avatar con iniciales si no hay foto. |
| Disciplinas | `js/catalogos.js` | CRUD con precio mensual. |
| Instructores | `js/catalogos.js` | CRUD + conteo de clases asignadas. |
| Horarios | `js/horarios.js` | CRUD, estado (Disponible / Casi lleno / Lleno), **ajuste manual de cupo** con registro en la bitácora de movimientos. |

### Etapa 3 — Núcleo maestro–detalle
| Módulo | Archivo | Detalle |
|---|---|---|
| Inscripciones | `js/inscripciones.js` | Se elige alumno + se agregan disciplinas/horarios/meses; el guardado llama a la función SQL `crear_inscripcion` que **valida cupo y duplicados, ocupa las plazas y registra los movimientos en una sola transacción**. Anulación (solo admin) con `anular_inscripcion`: libera plazas y borra pagos. |
| Pagos | `js/pagos.js` | Saldos pendientes, **cobro parcial o total**, historial, ingresos del día y del mes. Eliminar pago: solo admin. |

### Etapa 4 — Operación y control
| Módulo | Archivo | Detalle |
|---|---|---|
| Asistencia | `js/asistencia.js` | Fecha + clase → lista de alumnos con inscripción **vigente** en ese horario; se marca presente/ausente y se guarda (se puede corregir el mismo día). |
| Reportes | `js/reportes.js` | Rango de fechas: cobrado, facturado, ingresos por disciplina y **exportación real a Excel (.xlsx)** con SheetJS. |
| Usuarios | `js/usuarios_config.js` | Solo admin: roles y estado. ⚠ Ejecutar `supabase/03_modulo_usuarios.sql` una vez. |
| Configuración | `js/usuarios_config.js` | Datos del gimnasio + **días de anticipación y plantilla del mensaje de WhatsApp** + historial de avisos enviados. |

### Etapa 5 — 📲 Avisos de WhatsApp: dos formas

**Opción A · GRATIS (recomendada, ya activa):** el Dashboard detecta solo las
mensualidades por vencer y muestra un botón **"📲 Enviar WhatsApp"** por alumno.
Al tocarlo se abre WhatsApp (Web o la app) con el mensaje ya escrito y
personalizado — solo presionas enviar. Sale desde el WhatsApp normal del
gimnasio, no cuesta nada y cada aviso queda registrado para no repetirse.
No requiere configurar nada de Meta: funciona apenas subes el sitio.

**Opción B · Automática (de pago por mensaje):** la Edge Function envía los
avisos sola cada mañana usando la WhatsApp Cloud API de Meta. Cada plantilla
"utility" cuesta centavos de dólar por mensaje (con ~100 alumnos, ~1–3 USD/mes).
Si algún día quieres el envío 100% automático, sigue las instrucciones de abajo;
si no, puedes ignorarlas por completo.

### Etapa 5B — Configuración del envío automático (opcional, de pago)
Cada mañana se revisan las inscripciones que vencen en los próximos N días
(configurable) y se envía un WhatsApp al teléfono del alumno. Cada aviso queda
registrado en `avisos_whatsapp` (se envía **uno solo por inscripción**).

---

## 🚀 Instalación de las etapas 2–4

1. Si ya hiciste la Etapa 1, solo ejecuta en el SQL Editor: `supabase/03_modulo_usuarios.sql`.
2. Reemplaza la carpeta del sitio con esta versión (mantén tu `js/config.js` con tus llaves).
3. Verifica que exista el bucket **fotos-alumnos** en Storage (el esquema de la Etapa 1 ya lo crea).

Listo: todos los módulos aparecen en la barra lateral según el rol.

---

## 📲 Instalación de la Etapa 5 (WhatsApp)

### Opción recomendada: WhatsApp Cloud API de Meta (oficial y gratis hasta cierto volumen)

**A. Crear la app de WhatsApp**
1. Entra a [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App → Business**.
2. Agrega el producto **WhatsApp**. Meta te da un **número de prueba** gratis
   (sirve para probar con hasta 5 números verificados; para producción se
   conecta tu propio número del gimnasio).
3. Anota dos datos del panel *WhatsApp → API Setup*:
   - **Phone Number ID**
   - **Token de acceso** (genera un token permanente desde un System User en producción).

**B. Desplegar la función**
Con la [CLI de Supabase](https://supabase.com/docs/guides/functions) instalada:

```bash
supabase login
supabase link --project-ref TU-PROYECTO
supabase secrets set WHATSAPP_TOKEN=el_token_de_meta
supabase secrets set WHATSAPP_PHONE_ID=el_phone_number_id
supabase functions deploy aviso-whatsapp
```

> Alternativa sin CLI: en el panel de Supabase → **Edge Functions → Deploy new
> function**, pega el contenido de `supabase/functions/aviso-whatsapp/index.ts`
> y define los dos secretos en *Edge Functions → Secrets*.

**C. Programar el envío diario**
1. Abre `supabase/04_whatsapp_cron.sql`, reemplaza `TU-PROYECTO` y `TU_ANON_KEY`.
2. Ejecútalo en el SQL Editor. Queda programado **todos los días a las 09:00 (hora de Bolivia)**.

**D. Probar sin esperar al día siguiente**
En *Edge Functions → aviso-whatsapp → Invoke* (o con `curl` a la URL de la
función). La respuesta dice cuántos avisos encontró y envió, y el resultado se
ve en **Configuración → Avisos de WhatsApp enviados**.

### Requisitos para que el aviso llegue
- El teléfono del alumno debe estar **con código de país y sin signos**: `59171234567`.
- En modo de prueba de Meta, solo llegan mensajes a los números que agregues
  como destinatarios de prueba; en producción (con tu número verificado) llega a cualquiera.
- El mensaje se personaliza en **Configuración**: usa `{nombre}` y `{fecha}`.

### Alternativa: Twilio
Si prefieres Twilio (más simple de configurar, con costo por mensaje), solo se
cambia el `fetch` de la función por el endpoint de Twilio; avísame y te lo dejo listo.

---

## 🗺 Resumen de archivos SQL (orden de ejecución)
1. `01_esquema.sql` — tablas, funciones, seguridad, bucket de fotos.
2. `02_datos_ejemplo.sql` — datos de prueba y roles (tras crear los usuarios en Authentication).
3. `03_modulo_usuarios.sql` — función auxiliar del módulo Usuarios.
4. `04_whatsapp_cron.sql` — tarea diaria del aviso de WhatsApp (tras desplegar la función).
