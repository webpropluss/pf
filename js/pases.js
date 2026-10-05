// ============================================================
// PRIME FIT · Módulo Pases del día
// Para la gente que paga y entrena un solo día, sin mensualidad.
// El cobro se registra como un pago normal, así suma en Reportes.
// ============================================================

async function cargarPases(contenido) {
  const hoy = util.hoy();

  const [pases, config] = await Promise.all([
    db.from('pases_dia')
      // alumnos y horarios siguen aquí solo para los pases viejos,
      // que sí tenían visitante y clase. Los nuevos usan disciplina.
      .select('*, disciplinas(nombre), alumnos(nombre), horarios(dias, hora_inicio, disciplinas(nombre))')
      .order('fecha', { ascending: false }).order('id', { ascending: false }).limit(200),
    db.from('config').select('clave, valor').in('clave', ['precio_pase_dia', 'precio_pase_dia_2']),
  ]);

  const lista = pases.data || [];
  const C = {};
  (config.data || []).forEach(f => C[f.clave] = f.valor);
  const monto1 = Number(C.precio_pase_dia || 10);
  const monto2 = Number(C.precio_pase_dia_2 || 15);

  /** Qué clase muestra cada pase (los viejos traían el horario). */
  const claseDe = (p) => p.disciplinas?.nombre
    || p.horarios?.disciplinas?.nombre
    || '<span class="subtexto">Libre</span>';

  const deHoy  = lista.filter(p => p.fecha === hoy);
  const delMes = lista.filter(p => util.mes(p.fecha) === hoy.slice(0, 7));
  const totalHoy = deHoy.reduce((s, p) => s + Number(p.monto), 0);
  const totalMes = delMes.reduce((s, p) => s + Number(p.monto), 0);

  contenido.innerHTML = `
    <header class="cabecera"><h2>Pases del día</h2></header>

    <div class="toolbar">
      <button class="btn btn-rojo" onclick="dialogoPase(${monto1}, ${monto2})">＋ Nuevo pase del día</button>
    </div>

    <div class="tarjetas">
      <div class="tarjeta acento"><div class="etiqueta">Pases de hoy</div><div class="valor">${deHoy.length}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Cobrado hoy</div><div class="valor">${util.bs(totalHoy)}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Pases del mes</div><div class="valor">${delMes.length}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Cobrado en el mes</div><div class="valor">${util.bs(totalMes)}</div></div>
    </div>

    <div class="panel">
      <h3>Últimos pases</h3>
      ${lista.length ? `
        <table>
          <thead><tr><th>Fecha</th><th>Disciplina</th><th>Monto</th><th>Pago</th><th>Registró</th><th></th></tr></thead>
          <tbody>
            ${lista.map(p => `
              <tr>
                <td>${util.fecha(p.fecha)}${p.fecha === hoy ? ' <span class="pill pill-verde">Hoy</span>' : ''}</td>
                <td><strong>${claseDe(p)}</strong>
                    ${p.alumnos?.nombre ? `<div class="subtexto">${p.alumnos.nombre}</div>` : ''}</td>
                <td><strong>${util.bs(p.monto)}</strong></td>
                <td>${p.metodo_pago}</td>
                <td class="subtexto">${p.usuario_nombre || '—'}</td>
                <td class="acciones">
                  <button title="Eliminar pase" onclick="eliminarPase(${p.id})">🗑️</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`
        : '<p class="cargando">Todavía no se registró ningún pase del día.</p>'}
    </div>`;
}

/**
 * Formulario del pase: lo mínimo para cobrar rápido en la puerta.
 * Fecha, disciplina, monto y forma de pago. No se pide el nombre:
 * quien viene un solo día no se registra como alumno.
 */
async function dialogoPase(monto1, monto2) {
  const disciplinas = verificar(await db.from('disciplinas')
    .select('id, nombre').eq('activo', true).order('nombre'));

  abrirModal('Nuevo pase del día', `
    <div class="campo"><label>Fecha</label>
      <input type="date" name="fecha" required value="${util.hoy()}" max="${util.hoy()}"></div>

    <div class="campo"><label>Disciplina</label>
      <select name="disciplina_id" required>
        <option value="">— Elegir disciplina —</option>
        ${disciplinas.map(d => `<option value="${d.id}">${d.nombre}</option>`).join('')}
      </select></div>

    <div class="campo"><label>Monto</label>
      <div class="opciones" id="opcionesMonto">
        <button type="button" class="opcion activa" data-monto="${monto1}"
                onclick="elegirMonto(${monto1})">Bs. ${monto1}</button>
        <button type="button" class="opcion" data-monto="${monto2}"
                onclick="elegirMonto(${monto2})">Bs. ${monto2}</button>
        <button type="button" class="opcion" data-monto="otro"
                onclick="elegirMonto('otro')">Otro</button>
      </div>
      <input type="number" name="monto" min="0" step="0.01" required
             value="${monto1}" hidden></div>

    <div class="campo"><label>Pago</label>
      <div class="opciones" id="opcionesPago">
        <button type="button" class="opcion activa" onclick="elegirPago('Efectivo')">Efectivo</button>
        <button type="button" class="opcion" onclick="elegirPago('QR')">QR</button>
      </div>
      <input type="hidden" name="metodo_pago" value="Efectivo"></div>
  `, async (form) => {
    if (!form.disciplina_id.value) throw new Error('Elige la disciplina del pase.');
    const monto = Number(form.monto.value);
    if (!Number.isFinite(monto) || monto < 0) throw new Error('El monto no es válido.');

    const id = verificar(await db.rpc('crear_pase_dia', {
      p_fecha: form.fecha.value,
      p_disciplina_id: Number(form.disciplina_id.value),
      p_monto: monto,
      p_metodo_pago: form.metodo_pago.value,
      p_usuario_nombre: perfilActual?.nombre || '',
    }));

    notificar(`Pase registrado · ${util.bs(monto)} cobrados.`);
    abrirModulo('pases');
  }, 'Registrar pase');
}

/** Botones de monto. "Otro" destapa el campo para escribirlo. */
function elegirMonto(valor) {
  const campo = document.querySelector('#formModal [name="monto"]');
  if (!campo) return;

  document.querySelectorAll('#opcionesMonto .opcion').forEach(b =>
    b.classList.toggle('activa', b.dataset.monto === String(valor)));

  if (valor === 'otro') {
    campo.hidden = false;
    campo.value = '';
    campo.focus();
  } else {
    campo.hidden = true;
    campo.value = valor;
  }
}

/** Botones de forma de pago. */
function elegirPago(metodo) {
  const campo = document.querySelector('#formModal [name="metodo_pago"]');
  if (campo) campo.value = metodo;
  document.querySelectorAll('#opcionesPago .opcion').forEach(b =>
    b.classList.toggle('activa', b.textContent.trim() === metodo));
}

async function eliminarPase(id) {
  if (!confirmar('¿Eliminar este pase del día?\n\nTambién se borra su cobro de los reportes.')) return;
  const r = await db.rpc('eliminar_pase_dia', { p_pase_id: id });
  if (r.error) { notificar(r.error.message, true); return; }
  notificar('Pase eliminado.');
  abrirModulo('pases');
}
