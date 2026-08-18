# 🥊 Prime Fit Web — Etapa 1

Conversión del sistema local (C# / SQLite) a **versión web** con **HTML + CSS + JS + Supabase**.

## ¿Qué incluye esta etapa?
- Estructura del proyecto: `css/`, `js/`, `img/`, `supabase/`.
- **Esquema completo** de la base de datos en Postgres (todas las tablas del sistema local, más `avisos_whatsapp` para la automatización).
- Funciones SQL transaccionales `crear_inscripcion`, `anular_inscripcion` e `inscripciones_por_vencer` (la lógica maestro–detalle vive en la base, igual que en el sistema local).
- **Login** con Supabase Auth y control de **roles** (Administrador / Recepcionista / Cajero).
- **Dashboard** funcionando: alumnos activos, horarios, ingresos del mes, pagos pendientes, gráfico de 7 días y lista de mensualidades por vencer.

## Pasos de instalación

### 1. Crear el proyecto en Supabase
1. Entra a [supabase.com](https://supabase.com) → **New project** (plan gratuito sirve).
2. Anota la contraseña de la base (no la vas a necesitar en el código, solo para el panel).

### 2. Crear la base de datos
1. En el panel: **SQL Editor → New query**.
2. Pega el contenido de `supabase/01_esquema.sql` y presiona **Run**.

### 3. Crear los usuarios
1. **Authentication → Users → Add user** (marca *Auto Confirm User*):
   - `admin@primefit.com` / `admin123`
   - `recepcion@primefit.com` / `recepcion123`
   - `caja@primefit.com` / `caja123`
2. Vuelve al **SQL Editor** y ejecuta `supabase/02_datos_ejemplo.sql`
   (crea los perfiles con su rol y los datos de ejemplo: disciplinas, instructores, horarios y alumnos).

### 4. Conectar el sitio
1. En el panel: **Project Settings → API**.
2. Copia **Project URL** y **anon public key** dentro de `js/config.js`.

### 5. Probar
- Abre `index.html` con un servidor local (por ejemplo la extensión *Live Server* de VS Code, o `python -m http.server` en la carpeta).
- Entra con `admin@primefit.com` / `admin123`.
- Cuando quieras publicarlo gratis: sube la carpeta a **Netlify**, **Vercel** o **GitHub Pages**.

## Importante para la Etapa 5 (WhatsApp)
Guarda los teléfonos de los alumnos **con código de país y sin signos**, por ejemplo `59171234567`. Así la API de WhatsApp podrá enviarles el aviso automático antes de que venza su mes.

## Próximas etapas
- **Etapa 2:** Alumnos (foto en Supabase Storage), Disciplinas, Horarios, Instructores.
- **Etapa 3:** Inscripciones maestro–detalle y Pagos.
- **Etapa 4:** Asistencia y Reportes.
- **Etapa 5:** Edge Function + pg_cron → aviso automático por WhatsApp.
