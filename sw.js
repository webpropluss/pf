// ============================================================
// PRIME FIT · Service Worker
// Hace que la app se pueda INSTALAR en el celular y que abra rápido.
//
// Estrategia: "primero la red, si falla usa la copia guardada".
// Así nunca se queda pegada una versión vieja al actualizar el sitio.
// Los datos de Supabase NUNCA se guardan en caché (siempre van en vivo).
// ============================================================

// ⚠ Al subir cambios al sitio, sube este número (v2, v3...) para
//    forzar que todos los celulares tomen la versión nueva.
const VERSION = 'primefit-v9';

// Archivos base de la app (se guardan al instalar)
const ARCHIVOS = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './css/estilos.css',
  './js/config.js',
  './js/auth.js',
  './js/ui.js',
  './js/app.js',
  './js/dashboard.js',
  './js/alumnos.js',
  './js/catalogos.js',
  './js/horarios.js',
  './js/inscripciones.js',
  './js/pagos.js',
  './js/pases.js',
  './js/asistencia.js',
  './js/reportes.js',
  './js/usuarios_config.js',
  './img/logo_black.png',
  './img/login_side.png',
  './img/icon-192.png',
  './img/icon-512.png',
];

// ---------- Instalación: guardar los archivos base ----------
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      // addAll falla entero si un archivo falta: se agregan de a uno
      .then((c) => Promise.allSettled(ARCHIVOS.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

// ---------- Activación: borrar cachés de versiones anteriores ----------
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ---------- Peticiones ----------
self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Solo se maneja la app propia: Supabase y los CDN pasan directo a la red.
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    // cache: 'reload' evita que el navegador entregue una copia vieja suya
    fetch(req, { cache: 'reload' })
      .catch(() => fetch(req))
      .then((resp) => {
        // Guardar una copia fresca para cuando no haya internet
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(VERSION).then((c) => c.put(req, copia));
        }
        return resp;
      })
      .catch(async () => {
        // Sin internet: usar la copia guardada
        const guardado = await caches.match(req, { ignoreSearch: true });
        if (guardado) return guardado;
        // Si era una navegación, mostrar al menos el login
        if (req.mode === 'navigate') {
          const inicio = await caches.match('./index.html', { ignoreSearch: true });
          if (inicio) return inicio;
        }
        return Response.error();
      })
  );
});
