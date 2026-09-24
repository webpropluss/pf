// ============================================================
// PRIME FIT · Componentes de interfaz compartidos
// ============================================================

/**
 * Abre un modal con un formulario.
 * @param {string} titulo
 * @param {string} htmlCampos  HTML interno del formulario
 * @param {(form: HTMLFormElement) => Promise<void>} onGuardar  lanza Error para mostrar mensaje
 * @param {string} textoBoton
 */
function abrirModal(titulo, htmlCampos, onGuardar, textoBoton = 'Guardar') {
  cerrarModal();
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.id = 'modalActivo';
  fondo.innerHTML = `
    <div class="modal">
      <h3>${titulo}</h3>
      <form id="formModal">${htmlCampos}
        <div id="modalError" class="mensaje-error"></div>
        <div class="pie">
          <button type="button" class="btn btn-oscuro" onclick="cerrarModal()">Cancelar</button>
          <button type="submit" class="btn btn-rojo" id="btnModalGuardar">${textoBoton}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(fondo);
  fondo.addEventListener('click', e => { if (e.target === fondo) cerrarModal(); });

  const form = fondo.querySelector('#formModal');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('#btnModalGuardar');
    const err = form.querySelector('#modalError');
    err.classList.remove('visible');
    btn.disabled = true;
    try {
      await onGuardar(form);
      cerrarModal();
    } catch (ex) {
      err.textContent = ex.message || 'Ocurrió un error al guardar.';
      err.classList.add('visible');
      btn.disabled = false;
    }
  });
  const primero = form.querySelector('input, select, textarea');
  if (primero) primero.focus();
}

function cerrarModal() {
  document.getElementById('modalActivo')?.remove();
}

/** Confirmación simple. Devuelve true si el usuario acepta. */
function confirmar(mensaje) {
  return window.confirm(mensaje);
}

/** Notificación flotante. */
function notificar(mensaje, esError = false) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast' + (esError ? ' error' : '');
  t.textContent = mensaje;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/** Avatar con foto o iniciales. */
function avatarHtml(nombre, fotoUrl) {
  if (fotoUrl) return `<span class="avatar"><img src="${fotoUrl}" alt=""></span>`;
  const iniciales = (nombre || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  return `<span class="avatar">${iniciales}</span>`;
}

/** Lanza el error de Supabase como excepción legible. */
function verificar(respuesta) {
  if (respuesta.error) throw new Error(respuesta.error.message);
  return respuesta.data;
}

/** Genera el siguiente código correlativo, ej. ALU-008. */
async function siguienteCodigo(tabla, prefijo) {
  const { count } = await db.from(tabla).select('id', { count: 'exact', head: true });
  return `${prefijo}-${String((count || 0) + 1).padStart(3, '0')}`;
}

// ============================================================
// TABLAS EN EL TELÉFONO
// En pantallas chicas las tablas se muestran como tarjetas, una
// debajo de otra, para no tener que desplazarse de lado.
//
// Funciona solo: toma los títulos del encabezado y se los pega a
// cada celda como etiqueta. Sirve para todos los módulos, incluso
// los que se agreguen después.
// ============================================================

function adaptarTablasMovil(raiz = document) {
  raiz.querySelectorAll('table').forEach(tabla => {
    const titulos = [...tabla.querySelectorAll('thead th')].map(th => th.textContent.trim());
    if (!titulos.length) return;
    tabla.classList.add('tabla-tarjetas');

    tabla.querySelectorAll('tbody tr').forEach(fila => {
      [...fila.children].forEach((celda, i) => {
        if (celda.hasAttribute('data-etiqueta')) return;
        celda.setAttribute('data-etiqueta', titulos[i] || '');
      });
    });
  });
}

// Vigilar la pantalla: cada vez que un módulo dibuja o redibuja una
// tabla, se le ponen las etiquetas automáticamente.
(function vigilarTablas() {
  const aplicar = () => {
    observador.disconnect();
    adaptarTablasMovil();
    observador.observe(document.body, { childList: true, subtree: true });
  };
  const observador = new MutationObserver(aplicar);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicar);
  } else {
    aplicar();
  }
})();


// ============================================================
// TELÉFONOS
// En los formularios se escriben solo los 8 dígitos del celular.
// El código de país (591) se agrega y se quita automáticamente.
// ============================================================

/** Del número guardado (59171234567) saca los 8 dígitos para el formulario. */
function telefonoLocal(guardado) {
  const n = String(guardado || '').replace(/\D/g, '');
  return n.startsWith(CODIGO_PAIS) ? n.slice(CODIGO_PAIS.length) : n;
}

/** De los 8 dígitos arma el número completo que se guarda y usa WhatsApp. */
function telefonoCompleto(local) {
  const n = String(local || '').replace(/\D/g, '');
  if (!n) return '';
  return n.startsWith(CODIGO_PAIS) ? n : CODIGO_PAIS + n;
}

/** Cómo se muestra en las listas: +591 71234567 */
function telefonoMostrar(guardado) {
  const l = telefonoLocal(guardado);
  return l ? `+${CODIGO_PAIS} ${l}` : '—';
}

/**
 * Campo de teléfono con el +591 fijo al lado.
 * @param {string} nombre   name del input
 * @param {string} valor    número guardado (con o sin código de país)
 * @param {boolean} obligatorio
 */
function campoTelefono(nombre, valor, obligatorio = false) {
  return `<div class="tel-campo">
      <span class="tel-pais">+${CODIGO_PAIS}</span>
      <input name="${nombre}" type="tel" inputmode="numeric" maxlength="8"
             placeholder="71234567" ${obligatorio ? 'required' : ''}
             value="${telefonoLocal(valor)}">
    </div>`;
}

/**
 * Revisa los 8 dígitos y devuelve el número completo.
 * Lanza un error entendible si está mal.
 */
function validarTelefono(valorDelCampo, obligatorio = true) {
  let n = String(valorDelCampo || '').replace(/\D/g, '');
  if (!n) {
    if (obligatorio) throw new Error('Falta el número de celular (8 dígitos).');
    return '';
  }
  // Si pegaron el número completo con el código de país, se acepta igual
  if (n.length === CODIGO_PAIS.length + 8 && n.startsWith(CODIGO_PAIS)) {
    n = n.slice(CODIGO_PAIS.length);
  }
  if (n.length !== 8) {
    throw new Error(`El celular debe tener 8 dígitos; escribiste ${n.length}. No hace falta poner el ${CODIGO_PAIS}.`);
  }
  return telefonoCompleto(n);
}

// ============================================================
// FOTOS
// Las fotos se achican y comprimen EN EL TELÉFONO antes de subirlas.
// Una foto de celular de 3 MB queda en unos 40 KB, así el espacio
// del servidor rinde y las listas cargan rápido.
// ============================================================

/** Carga el archivo como imagen para poder redibujarla. */
function _cargarImagen(archivo) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

function _aBlob(lienzo, tipo, calidad) {
  return new Promise((ok) => lienzo.toBlob(ok, tipo, calidad));
}

/**
 * Achica la foto a un cuadrado y la comprime.
 * @param {File} archivo    la foto elegida
 * @param {number} maxLado  lado máximo en píxeles
 * @param {number} calidad  0 a 1
 * @returns {Promise<{blob: Blob, extension: string, kb: number}>}
 */
async function comprimirImagen(archivo, maxLado = 500, calidad = 0.75) {
  if (!archivo.type.startsWith('image/')) throw new Error('Ese archivo no es una imagen.');

  const img = await _cargarImagen(archivo);
  const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
  const ancho = Math.max(1, Math.round(img.width * escala));
  const alto  = Math.max(1, Math.round(img.height * escala));

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho; lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, ancho, alto);

  // WebP pesa bastante menos; si el navegador no lo soporta, se usa JPEG
  let blob = await _aBlob(lienzo, 'image/webp', calidad);
  let extension = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await _aBlob(lienzo, 'image/jpeg', calidad);
    extension = 'jpg';
  }
  if (!blob) throw new Error('No se pudo procesar la imagen.');

  return { blob, extension, kb: Math.round(blob.size / 1024) };
}

/**
 * Comprime y sube una foto, y devuelve su dirección pública.
 * @param {File} archivo
 * @param {string} deposito  bucket de Supabase Storage
 * @param {string} prefijo   para armar el nombre del archivo
 */
async function subirFoto(archivo, deposito, prefijo = 'foto', maxLado = 500) {
  const { blob, extension, kb } = await comprimirImagen(archivo, maxLado);

  const ruta = `${prefijo}_${Date.now()}.${extension}`;
  const sub = await db.storage.from(deposito).upload(ruta, blob, {
    contentType: blob.type, upsert: true,
  });
  if (sub.error) throw new Error('No se pudo subir la foto: ' + sub.error.message);

  return {
    url: db.storage.from(deposito).getPublicUrl(ruta).data.publicUrl,
    kb,
  };
}

/** Borra una foto del depósito a partir de su dirección. */
async function borrarFoto(url, deposito) {
  if (!url) return;
  const archivo = String(url).split('/').pop().split('?')[0];
  if (archivo) await db.storage.from(deposito).remove([archivo]);
}

/**
 * Muestra el peso de la foto elegida antes de guardar, para que se vea
 * cuánto se comprimió.
 */
async function previsualizarFoto(input, idAviso, idVista, maxLado = 500) {
  const aviso = document.getElementById(idAviso);
  const vista = document.getElementById(idVista);
  const archivo = input.files?.[0];
  if (!archivo) { if (aviso) aviso.textContent = ''; if (vista) vista.innerHTML = ''; return; }

  const kbOriginal = Math.round(archivo.size / 1024);
  if (aviso) aviso.textContent = 'Procesando la foto…';
  try {
    const { blob, kb } = await comprimirImagen(archivo, maxLado);
    if (aviso) {
      aviso.innerHTML = `Se subirá comprimida: <strong>${kb} KB</strong> ` +
        `<span class="subtexto">(la original pesa ${kbOriginal} KB)</span>`;
    }
    if (vista) vista.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="Vista previa">`;
  } catch (e) {
    if (aviso) aviso.textContent = e.message;
  }
}
