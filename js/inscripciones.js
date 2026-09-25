// ============================================================
// PRIME FIT · Módulo Inscripciones (maestro–detalle)
// La transacción vive en la función SQL crear_inscripcion().
// ============================================================

let insDetalles = [];   // líneas de la nueva inscripción
let insCatalogo = { disciplinas: [], horarios: [] };
let insAlumnos = [];    // lista de alumnos, para el buscador
let pagoEditadoAMano = false;   // si tocan "Paga ahora", deja de seguir al total

async function cargarInscripciones(contenido) {
  const [inscripciones, pagos] = await Promise.all([
    db.from('inscripciones').select('*, alumnos(nombre)').order('id', { ascending: false }).limit(200),
    db.from('pagos').select('inscripcion_id, monto'),
  ]);
  const pagadoPor = {};
  (pagos.data || []).forEach(p => pagadoPor[p.inscripcion_id] = (pagadoPor[p.inscripcion_id] || 0) + Number(p.monto));

  const puedeAnular   = puedeAccion('anular');
  const puedeEliminar = puedeAccion('eliminar');

  contenido.innerHTML = `
    <header class="cabecera"><h2>Inscripciones</h2></header>
    <div class="toolbar">
      <button class="btn btn-rojo" onclick="nuevaInscripcion()">＋ Nueva inscripción</button>
    </div>
    <div class="panel">
      <table>
        <thead><tr><th>N°</th><th>Fecha</th><th>Alumno</th><th>Vigencia</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${(inscripciones.data || []).map(i => {
            const pagado = pagadoPor[i.id] || 0;
            const saldo = Math.max(Number(i.total) - pagado, 0);
            const estado = i.anulada
              ? '<span class="pill pill-rojo">Anulada</span>'
              : saldo <= 0 ? '<span class="pill pill-verde">Pagado</span>'
              : pagado > 0 ? '<span class="pill pill-amarillo">Parcial</span>'
              : '<span class="pill pill-rojo">Pendiente</span>';
            return `
              <tr style="${i.anulada ? 'opacity:.5' : ''}">
                <td>${i.numero}</td>
                <td>${util.fecha(String(i.fecha).slice(0, 10))}</td>
                <td><strong>${i.alumnos?.nombre || '—'}</strong></td>
                <td>${util.fecha(i.fecha_inicio)} → ${util.fecha(i.fecha_fin)}</td>
                <td>${util.bs(i.total)}</td>
                <td>${util.bs(pagado)}</td>
                <td>${util.bs(saldo)}</td>
                <td>${estado}</td>
                <td class="acciones">
                  ${puedeAnular && !i.anulada
                    ? `<button title="Anular: libera la plaza y conserva el pago (para quien se fue y vuelve con fechas nuevas)" onclick="anularInscripcion(${i.id})">🚫</button>` : ''}
                  ${puedeEliminar
                    ? `<button title="Eliminar definitivamente" onclick="eliminarInscripcion(${i.id}, ${i.numero})">🗑️</button>` : ''}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ---------------------- NUEVA INSCRIPCIÓN ----------------------

async function nuevaInscripcion() {
  const [alumnos, disciplinas, horarios] = await Promise.all([
    db.from('alumnos').select('id, nombre, codigo, telefono, foto_url').eq('activo', true).order('nombre'),
    db.from('disciplinas').select('*').eq('activo', true).order('nombre'),
    db.from('horarios').select('*, instructores(nombre)').eq('activo', true).order('id'),
  ]);
  insCatalogo = { disciplinas: disciplinas.data || [], horarios: horarios.data || [] };
  insAlumnos = alumnos.data || [];
  insDetalles = [];
  pagoEditadoAMano = false;

  const hoy = util.hoy();
  const fin = new Date(); fin.setMonth(fin.getMonth() + 1);

  abrirModal('Nueva inscripción', `
    <div class="campo"><label>Alumno</label>
      <div id="insBuscador">
        <input type="search" id="insBuscaAlumno" autocomplete="off"
               placeholder="Escribe el nombre del alumno…"
               oninput="buscarAlumnoIns()">
        <span class="subtexto">Escribe unas letras del nombre y tócalo en la lista.</span>
      </div>
      <div id="insElegido"></div>
      <div id="insResultados" class="resultados-venta"></div>
      <input type="hidden" name="alumno_id" id="insAlumnoId" value="">
    </div>
    <div class="fila">
      <div class="campo"><label>Inicio</label><input type="date" name="fecha_inicio" required value="${hoy}"></div>
      <div class="campo"><label>Fin (vence)</label><input type="date" name="fecha_fin" required value="${fin.toISOString().slice(0,10)}"></div>
    </div>

    <h3 style="font-size:18px;margin:6px 0 10px">Disciplinas y horarios</h3>
    <div class="detalle-linea">
      <div class="campo" style="margin:0"><label>Disciplina</label>
        <select id="selDisciplina" onchange="filtrarHorariosIns()">
          <option value="">—</option>
          ${insCatalogo.disciplinas.map(d => `<option value="${d.id}">${d.nombre} · ${util.bs(d.precio_mensual)}</option>`).join('')}
        </select></div>
      <div class="campo" style="margin:0"><label>Horario</label>
        <select id="selHorario"><option value="">—</option></select></div>
      <div class="campo" style="margin:0"><label>Precio Bs. <span class="subtexto">(editable)</span></label>
        <input type="number" id="inpPrecio" min="0" step="0.01" placeholder="0.00"></div>
      <div class="campo" style="margin:0"><label>Meses</label>
        <input type="number" id="inpMeses" min="1" value="1"></div>
      <button type="button" class="btn btn-oscuro" onclick="agregarDetalleIns()"
              title="Agregar esta clase a la inscripción">＋<span class="solo-movil"> Agregar clase</span></button>
    </div>
    <p class="subtexto" id="avisoPrecio" style="margin:-4px 0 12px"></p>
    <div id="tablaDetalles"></div>

    <div class="fila">
      <div class="campo"><label>Descuento (Bs.)</label>
        <input type="number" name="descuento" min="0" step="0.01" value="0" oninput="pintarDetallesIns()"></div>
      <div class="campo"><label>Método de pago</label>
        <select name="metodo_pago">
          <option>Efectivo</option><option>QR</option><option>Tarjeta</option><option>Transferencia</option>
        </select></div>
    </div>

    <h3 style="font-size:18px;margin:6px 0 10px">Cobro</h3>
    <div class="campo"><label>Paga ahora (Bs.)</label>
      <input type="number" name="pago_inicial" min="0" step="0.01" value="0"
             oninput="pagoEditadoAMano = true; pintarDetallesIns()">
      <span class="subtexto">Viene con el total puesto. Si paga menos, la diferencia
        queda como saldo pendiente en Pagos. Si pone 0, no se cobra nada ahora.</span></div>

    <div class="total-grande" id="totalIns">Bs. 0.00 <small>total</small></div>
  `, async (form) => {
    // Si escribió un nombre que deja una sola coincidencia pero no llegó
    // a tocarla, se toma esa: es la que quería.
    if (!form.alumno_id.value) {
      const unico = alumnosQueCoinciden();
      if (unico.length === 1) elegirAlumnoIns(unico[0].id);
    }
    if (!form.alumno_id.value) {
      throw new Error(document.getElementById('insBuscaAlumno')?.value.trim()
        ? 'Toca el alumno en la lista para seleccionarlo.'
        : 'Busca al alumno por su nombre y tócalo en la lista.');
    }

    // Si eligió disciplina y horario pero no tocó "＋ Agregar clase",
    // se agrega sola: es lo que quería hacer.
    if (!insDetalles.length) agregarDetalleIns(true);

    if (!insDetalles.length) {
      const hayDisciplina = !!document.getElementById('selDisciplina')?.value;
      const hayHorario    = !!document.getElementById('selHorario')?.value;
      throw new Error(
        !hayDisciplina ? 'Elige la disciplina y su horario, y toca "＋ Agregar clase".'
        : !hayHorario  ? 'Falta elegir el horario de la clase.'
        : 'No se pudo agregar la clase. Revisa el precio y vuelve a intentar.');
    }
    const id = verificar(await db.rpc('crear_inscripcion', {
      p_alumno_id: Number(form.alumno_id.value),
      p_fecha_inicio: form.fecha_inicio.value,
      p_fecha_fin: form.fecha_fin.value,
      p_descuento: Number(form.descuento.value || 0),
      p_metodo_pago: form.metodo_pago.value,
      p_usuario_nombre: perfilActual?.nombre || '',
      p_pago_inicial: Number(form.pago_inicial?.value || 0),
      p_detalles: insDetalles.map(d => ({
        disciplina_id: d.disciplina_id, horario_id: d.horario_id,
        precio_mensual: d.precio,                        // lo que realmente se le cobra
        precio_lista: d.precioLista ?? d.precio,         // precio normal, para ver el descuento
        meses: d.meses,
      })),
    }));
    const cobrado = Number(form.pago_inicial?.value || 0);
    notificar(cobrado > 0
      ? `Inscripción registrada (INS-${id}) y cobro de ${util.bs(cobrado)} anotado.`
      : `Inscripción registrada (INS-${id}). Queda pendiente de pago.`);
    abrirModulo('inscripciones');
  }, 'Guardar inscripción');
  buscarAlumnoIns();
  pintarDetallesIns();
}

// ---------------------- BUSCADOR DE ALUMNO ----------------------
// Con 100 alumnos una lista desplegable es inmanejable: se escribe
// el nombre, aparecen las coincidencias y se toca la correcta.

/** Alumnos que coinciden con lo que se escribió (máx. 8). */
function alumnosQueCoinciden() {
  const q = (document.getElementById('insBuscaAlumno')?.value || '').trim().toLowerCase();
  if (!q) return [];
  return insAlumnos
    .filter(a => (a.nombre + ' ' + (a.codigo || '') + ' ' + (a.telefono || ''))
      .toLowerCase().includes(q))
    .slice(0, 6);   // 6 caben en la pantalla del teléfono sin tapar el resto
}

/** Dibuja la lista de coincidencias mientras se escribe. */
function buscarAlumnoIns() {
  const caja = document.getElementById('insResultados');
  if (!caja) return;

  // Con un alumno ya elegido no se muestra la lista
  if (document.getElementById('insAlumnoId')?.value) { caja.innerHTML = ''; return; }

  const q = (document.getElementById('insBuscaAlumno')?.value || '').trim();
  if (!q) { caja.innerHTML = ''; return; }

  const hallados = alumnosQueCoinciden();
  caja.innerHTML = hallados.length ? hallados.map(a => `
    <button type="button" class="resultado-item" onclick="elegirAlumnoIns(${a.id})">
      ${avatarHtml(a.nombre, a.foto_url)}
      <span class="texto">
        <span class="nombre">${a.nombre}</span>
        <span class="datos">${a.codigo || ''}${a.telefono ? ' · ' + telefonoMostrar(a.telefono) : ''}</span>
      </span>
    </button>`).join('')
    : `<p class="subtexto" style="padding:4px 0 6px">No hay ningún alumno que diga “${q}”.
         Revisa cómo está escrito o regístralo primero en <strong>Alumnos</strong>.</p>`;
}

/** Deja el alumno fijo a la vista y esconde el buscador. */
function elegirAlumnoIns(id) {
  const a = insAlumnos.find(x => x.id === id);
  if (!a) return;

  document.getElementById('insAlumnoId').value = a.id;
  document.getElementById('insResultados').innerHTML = '';
  const buscador = document.getElementById('insBuscador');
  if (buscador) buscador.hidden = true;

  document.getElementById('insElegido').innerHTML = `
    <div class="elegido">
      ${avatarHtml(a.nombre, a.foto_url)}
      <span class="texto">
        <span class="nombre">${a.nombre}</span>
        <span class="datos">${a.codigo || ''}${a.telefono ? ' · ' + telefonoMostrar(a.telefono) : ''}</span>
      </span>
      <button type="button" class="btn btn-oscuro" onclick="cambiarAlumnoIns()">Cambiar</button>
    </div>`;
}

/** Vuelve al buscador para elegir otro alumno. */
function cambiarAlumnoIns() {
  document.getElementById('insAlumnoId').value = '';
  document.getElementById('insElegido').innerHTML = '';
  const buscador = document.getElementById('insBuscador');
  if (buscador) buscador.hidden = false;
  const campo = document.getElementById('insBuscaAlumno');
  if (campo) { campo.value = ''; campo.focus(); }
  buscarAlumnoIns();
}

function filtrarHorariosIns() {
  const disId = Number(document.getElementById('selDisciplina').value);
  const sel = document.getElementById('selHorario');
  sel.innerHTML = '<option value="">—</option>' + insCatalogo.horarios
    .filter(h => h.disciplina_id === disId)
    .map(h => {
      const disp = Math.max(h.cupo - h.inscritos, 0);
      return `<option value="${h.id}" ${disp <= 0 ? 'disabled' : ''}>
        ${h.dias} ${h.hora_inicio} · ${h.instructores?.nombre || ''} · ${disp} libres${disp <= 0 ? ' (LLENO)' : ''}</option>`;
    }).join('');

  // Cargar el precio de lista de la disciplina; se puede cambiar para dar descuento
  const dis = insCatalogo.disciplinas.find(d => d.id === disId);
  const inpPrecio = document.getElementById('inpPrecio');
  const aviso = document.getElementById('avisoPrecio');
  if (inpPrecio) inpPrecio.value = dis ? Number(dis.precio_mensual) : '';
  if (aviso) {
    aviso.textContent = dis
      ? `Precio normal de ${dis.nombre}: ${util.bs(dis.precio_mensual)} · cámbialo si le haces precio especial.`
      : '';
  }
}

/**
 * Agrega la clase elegida a la lista de la inscripción.
 * @param {boolean} automatico  true cuando se llama sola al guardar:
 *                              en ese caso no muestra avisos sueltos.
 * @returns {boolean} si la clase quedó agregada
 */
function agregarDetalleIns(automatico = false) {
  const avisar = (m) => { if (!automatico) notificar(m, true); };

  const disId = Number(document.getElementById('selDisciplina').value);
  const horId = Number(document.getElementById('selHorario').value);
  const meses = Math.max(1, Number(document.getElementById('inpMeses').value || 1));
  if (!disId || !horId) { avisar('Elige la disciplina y el horario.'); return false; }
  if (insDetalles.some(d => d.horario_id === horId)) { avisar('Ese horario ya está en la lista.'); return false; }

  const dis = insCatalogo.disciplinas.find(d => d.id === disId);
  const hor = insCatalogo.horarios.find(h => h.id === horId);

  // Precio de lista vs. precio que se le cobra (puede ser menor por promoción)
  const precioLista = Number(dis.precio_mensual);
  const campoPrecio = document.getElementById('inpPrecio').value;
  const precio = campoPrecio === '' ? precioLista : Number(campoPrecio);

  if (isNaN(precio) || precio < 0) { avisar('El precio no es válido.'); return false; }
  if (precio > precioLista) {
    if (!confirmar(`El precio ${util.bs(precio)} es MAYOR al normal (${util.bs(precioLista)}). ¿Continuar igual?`)) return false;
  }

  insDetalles.push({
    disciplina_id: disId, horario_id: horId, meses,
    precio, precioLista,
    texto: `${dis.nombre} · ${hor.dias} ${hor.hora_inicio}`,
  });
  document.getElementById('inpPrecio').value = '';
  document.getElementById('avisoPrecio').textContent = '';
  pintarDetallesIns();
  return true;
}

function quitarDetalleIns(i) { insDetalles.splice(i, 1); pintarDetallesIns(); }

function pintarDetallesIns() {
  const cont = document.getElementById('tablaDetalles');
  if (!cont) return;
  cont.innerHTML = insDetalles.length ? `
    <table style="margin-bottom:14px">
      <thead><tr><th>Clase</th><th>Precio normal</th><th>Se le cobra</th><th>Meses</th><th>Subtotal</th><th></th></tr></thead>
      <tbody>${insDetalles.map((d, i) => {
        const rebaja = (d.precioLista ?? d.precio) - d.precio;
        return `
        <tr>
          <td>${d.texto}</td>
          <td class="subtexto" style="${rebaja > 0 ? 'text-decoration:line-through' : ''}">${util.bs(d.precioLista ?? d.precio)}</td>
          <td><strong>${util.bs(d.precio)}</strong>
              ${rebaja > 0 ? `<div><span class="pill pill-verde">−${util.bs(rebaja)}</span></div>` : ''}</td>
          <td>${d.meses}</td>
          <td>${util.bs(d.precio * d.meses)}</td>
          <td class="acciones"><button type="button" onclick="quitarDetalleIns(${i})">✖️</button></td>
        </tr>`; }).join('')}
      </tbody>
    </table>` : '<p class="subtexto" style="margin-bottom:14px">Sin clases agregadas todavía · elige disciplina y horario arriba, y toca <strong>＋ Agregar clase</strong>.</p>';

  const sub    = insDetalles.reduce((s, d) => s + d.precio * d.meses, 0);
  const lista  = insDetalles.reduce((s, d) => s + (d.precioLista ?? d.precio) * d.meses, 0);
  const rebaja = Math.max(lista - sub, 0);   // descuento hecho en los precios
  const descInput = document.querySelector('#formModal [name="descuento"]');
  const desc  = Number(descInput?.value || 0);  // descuento extra sobre el total
  const total = Math.max(sub - desc, 0);

  // Mientras no lo toquen a mano, el cobro sigue al total
  const campoPago = document.querySelector('#formModal [name="pago_inicial"]');
  if (campoPago && !pagoEditadoAMano) campoPago.value = total;
  const paga = Math.min(Number(campoPago?.value || 0), total);
  const saldo = Math.max(total - paga, 0);

  const el = document.getElementById('totalIns');
  if (el) {
    el.innerHTML = `${util.bs(total)} <small>subtotal ${util.bs(sub)}` +
      (rebaja > 0 ? ` · precio especial −${util.bs(rebaja)}` : '') +
      (desc > 0 ? ` · desc. −${util.bs(desc)}` : '') +
      `<br>paga ahora ${util.bs(paga)}` +
      (saldo > 0 ? ` · <span style="color:var(--amarillo)">queda debiendo ${util.bs(saldo)}</span>`
                 : ' · <span style="color:var(--verde)">pagado completo</span>') +
      `</small>`;
  }
}

/** Borra la inscripción por completo (para datos de prueba). */
async function eliminarInscripcion(id, numero) {
  if (!confirmar(
    `¿Eliminar la inscripción N° ${numero} para siempre?\n\n` +
    '⚠ Se borran TAMBIÉN SUS PAGOS y desaparecen de los reportes.\n' +
    'Las plazas que ocupaba quedarán libres.\n\n' +
    'Úsalo solo si fue un error o una prueba.\n' +
    'Si el alumno dejó de venir (aunque haya pagado), usa 🚫 Anular:\n' +
    'libera la plaza y conserva el dinero cobrado.')) return;

  const r = await db.rpc('eliminar_inscripcion', { p_inscripcion_id: id });
  if (r.error) { notificar(r.error.message, true); return; }
  notificar(`Inscripción N° ${numero} eliminada.`);
  abrirModulo('inscripciones');
}

async function anularInscripcion(id) {
  if (!confirmar(
    '¿Anular esta inscripción?\n\n' +
    '• Se libera la plaza en la clase.\n' +
    '• El dinero que ya pagó SE CONSERVA en los reportes.\n' +
    '• Podrás hacerle una inscripción nueva con otras fechas.\n\n' +
    'Es lo correcto cuando el alumno deja de venir y después vuelve.')) return;
  const r = await db.rpc('anular_inscripcion', { p_inscripcion_id: id, p_usuario_nombre: perfilActual?.nombre || '' });
  if (r.error) { notificar(r.error.message, true); return; }
  notificar('Inscripción anulada. Plaza liberada y el pago se conservó.');
  abrirModulo('inscripciones');
}
