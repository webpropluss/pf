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
