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
