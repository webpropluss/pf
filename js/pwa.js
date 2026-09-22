// ============================================================
// PRIME FIT · Instalación en el celular (PWA)
// Registra el service worker y muestra el botón "Instalar app".
// ============================================================

// ---------- Registrar el service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Falla en local sin servidor (file://). No es un problema: solo
      // significa que aún no se puede instalar; la app funciona igual.
    });
  });
}

// ---------- Botón "Instalar app" (Android / Chrome / Edge) ----------
let eventoInstalar = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();          // evitar el aviso automático del navegador
  eventoInstalar = e;
  mostrarBotonInstalar();
});

function mostrarBotonInstalar() {
  if (document.getElementById('btnInstalarApp')) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return; // ya instalada

  const btn = document.createElement('button');
  btn.id = 'btnInstalarApp';
  btn.className = 'btn btn-rojo boton-instalar';
  btn.innerHTML = '⬇ Instalar app';
  btn.onclick = async () => {
    if (!eventoInstalar) return;
    btn.disabled = true;
    eventoInstalar.prompt();
    const { outcome } = await eventoInstalar.userChoice;
    eventoInstalar = null;
    btn.remove();
    if (outcome === 'accepted' && typeof notificar === 'function') {
      notificar('Prime Fit se instaló en tu dispositivo.');
    }
  };
  document.body.appendChild(btn);
}

// Al instalarse, quitar el botón
window.addEventListener('appinstalled', () => {
  document.getElementById('btnInstalarApp')?.remove();
  eventoInstalar = null;
});

/**
 * Instrucciones para iPhone/iPad: Safari no ofrece botón de instalación,
 * hay que usar Compartir → Añadir a pantalla de inicio.
 * Se muestra una sola vez por dispositivo.
 */
(function avisoiOS() {
  const esiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const yaInstalada = window.navigator.standalone === true;
  if (!esiOS || yaInstalada) return;

  try {
    if (localStorage.getItem('primefit_aviso_ios') === 'visto') return;
  } catch (e) { return; }   // modo privado: no molestar

  window.addEventListener('load', () => {
    setTimeout(() => {
      const aviso = document.createElement('div');
      aviso.className = 'aviso-ios';
      aviso.innerHTML = `
        <strong>Instala Prime Fit en tu iPhone</strong>
        <span>Toca <b>Compartir</b> &#x2191; y luego <b>Añadir a pantalla de inicio</b>.</span>
        <button class="btn btn-oscuro">Entendido</button>`;
      aviso.querySelector('button').onclick = () => {
        try { localStorage.setItem('primefit_aviso_ios', 'visto'); } catch (e) {}
        aviso.remove();
      };
      document.body.appendChild(aviso);
    }, 2500);
  });
})();
