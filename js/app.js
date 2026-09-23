// ============================================================
// PRIME FIT · Núcleo de la aplicación (sesión, roles, navegación)
// ============================================================

let perfilActual = null;

/** Utilidades compartidas por todos los módulos */
const util = {
  bs: (n) => 'Bs. ' + Number(n || 0).toFixed(2),
  fecha: (f) => f ? new Date(f + (String(f).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-BO') : '',
  hoy: () => new Date().toISOString().slice(0, 10),
};

/** Módulos registrados. Cada etapa agrega los suyos aquí. */
const modulos = {
  dashboard:     { titulo: 'Dashboard',     cargar: cargarDashboard },
  alumnos:       { titulo: 'Alumnos',       cargar: cargarAlumnos },
  disciplinas:   { titulo: 'Disciplinas',   cargar: cargarDisciplinas },
  horarios:      { titulo: 'Horarios',      cargar: cargarHorarios },
  instructores:  { titulo: 'Instructores',  cargar: cargarInstructores },
  inscripciones: { titulo: 'Inscripciones', cargar: cargarInscripciones },
  pagos:         { titulo: 'Pagos',         cargar: cargarPagos },
  pases:         { titulo: 'Pases del día', cargar: cargarPases },
  asistencia:    { titulo: 'Asistencia',    cargar: cargarAsistencia },
  reportes:      { titulo: 'Reportes',      cargar: cargarReportes },
  usuarios:      { titulo: 'Usuarios',      cargar: cargarUsuarios },
  configuracion: { titulo: 'Configuración', cargar: cargarConfiguracion },
};

let moduloActual = null;
let pilaModulos = [];   // por dónde pasó el usuario, para el gesto "atrás"

function abrirModulo(nombre, esRetroceso = false) {
  // Guardar de dónde venimos, salvo cuando ya estamos retrocediendo
  if (!esRetroceso && moduloActual && moduloActual !== nombre) {
    pilaModulos.push(moduloActual);
    if (pilaModulos.length > 20) pilaModulos.shift();
  }
  moduloActual = nombre;

  document.querySelectorAll('.nav-item').forEach(i =>
    i.classList.toggle('activo', i.dataset.modulo === nombre));

  const contenido = document.getElementById('contenido');
  const mod = modulos[nombre];

  if (!mod) {
    contenido.innerHTML = `
      <header class="cabecera"><h2>${nombre}</h2></header>
      <div class="panel"><p class="cargando">Este módulo se agregará en la siguiente etapa. 🚧</p></div>`;
    return;
  }
  contenido.innerHTML = `<p class="cargando">Cargando ${mod.titulo}…</p>`;
  mod.cargar(contenido);
  window.scrollTo(0, 0);
}

document.addEventListener('DOMContentLoaded', async () => {
  perfilActual = await requerirSesion();
  if (!perfilActual) return;

  document.getElementById('usuarioNombre').textContent = perfilActual.nombre;
  document.getElementById('usuarioRol').textContent = perfilActual.rol;

  // Ocultar módulos exclusivos del administrador
  if (perfilActual.rol !== 'Administrador') {
    document.querySelectorAll('[data-solo-admin]').forEach(i => i.remove());
  }

  document.querySelectorAll('.nav-item').forEach(item =>
    item.addEventListener('click', () => {
      abrirModulo(item.dataset.modulo);
      cerrarMenuMovil();   // en el teléfono, cerrar el menú al elegir
    }));

  abrirModulo('dashboard');
  configurarGestoAtras();

  // "Latido" para mantener la base despierta (no se suspende por inactividad).
  // Falla en silencio si la tabla ping aún no existe.
  db.rpc('ping_keepalive').then(() => {}).catch(() => {});
});

/**
 * El gesto de deslizar hacia atrás (o el botón ← del teléfono) ya NO saca de
 * la aplicación: navega dentro de ella. Antes salía a la pantalla de login y
 * parecía que se había cerrado la sesión.
 *
 * Orden de lo que hace "atrás":
 *   1. cierra el formulario abierto,
 *   2. cierra el menú lateral,
 *   3. vuelve al módulo anterior,
 *   4. si ya está en el Dashboard, se queda ahí.
 * Para salir se usa el botón "Cerrar sesión".
 */
function configurarGestoAtras() {
  history.pushState({ pf: 1 }, '');

  window.addEventListener('popstate', () => {
    if (document.getElementById('modalActivo')) {
      cerrarModal();
    } else if (document.querySelector('.sidebar')?.classList.contains('abierto')) {
      cerrarMenuMovil();
    } else if (pilaModulos.length) {
      abrirModulo(pilaModulos.pop(), true);
    }
    // Reponer siempre el estado: así el "atrás" nunca abandona la aplicación
    history.pushState({ pf: 1 }, '');
  });
}

// ---------- Menú lateral en móviles ----------
function alternarMenuMovil() {
  document.querySelector('.sidebar')?.classList.toggle('abierto');
  document.getElementById('fondoMenu')?.classList.toggle('visible');
}
function cerrarMenuMovil() {
  document.querySelector('.sidebar')?.classList.remove('abierto');
  document.getElementById('fondoMenu')?.classList.remove('visible');
}
