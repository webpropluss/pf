// ============================================================
// PRIME FIT · Módulo Pases del día
// Para la gente que paga y entrena un solo día, sin mensualidad.
// El cobro se registra como un pago normal, así suma en Reportes.
// ============================================================

async function cargarPases(contenido) {
  const hoy = util.hoy();

  const [pases, config] = await Promise.all([
    db.from('pases_dia')
      .select('*, alumnos(nombre, telefono, foto_url), horarios(dias, hora_inicio, disciplinas(nombre))')
      .order('fecha', { ascending: false }).order('id', { ascending: false }).limit(200),
    db.from('config').select('valor').eq('clave', 'precio_pase_dia').single(),
  ]);

  const lista = pases.data || [];
  const precioSugerido = Number(config.data?.valor || 25);

  const deHoy  = lista.filter(p => p.fecha === hoy);
  const delMes = lista.filter(p => String(p.fecha).slice(0, 7) === hoy.slice(0, 7));
  const totalHoy = deHoy.reduce((s, p) => s + Number(p.monto), 0);
  const totalMes = delMes.reduce((s, p) => s + Number(p.monto), 0);

  contenido.innerHTML = `
    <header class="cabecera"><h2>Pases del día</h2></header>

    <div class="toolbar">
      <button class="btn btn-rojo" onclick="dialogoPase(${precioSugerido})">＋ Nuevo pase del día</button>
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
          <thead><tr><th></th><th>Persona</th><th>Fecha</th><th>Clase</th><th>Monto</th><th>Pago</th><th>Registró</th><th></th></tr></thead>
          <tbody>
            ${lista.map(p => `
              <tr>
                <td>${avatarHtml(p.alumnos?.nombre || '?', p.alumnos?.foto_url)}</td>
                <td><strong>${p.alumnos?.nombre || '—'}</strong>
                    <div class="subtexto">${telefonoMostrar(p.alumnos?.telefono)}</div></td>
                <td>${util.fecha(p.fecha)}${p.fecha === hoy ? ' <span class="pill pill-verde">Hoy</span>' : ''}</td>
                <td>${p.horarios
                      ? `${p.horarios.disciplinas?.nombre || ''} · ${p.horarios.dias} ${p.horarios.hora_inicio}`
                      : '<span class="subtexto">Libre</span>'}</td>
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

/** Formulario del pase: alumno existente o visitante nuevo. */
async function dialogoPase(precioSugerido) {
  const [alumnos, horarios] = await Promise.all([
    db.from('alumnos').select('id, nombre').eq('activo', true).order('nombre'),
    db.from('horarios').select('id, dias, hora_inicio, disciplinas(nombre)').eq('activo', true).order('id'),
  ]);

  abrirModal('Nuevo pase del día', `
    <div class="campo"><label>¿Quién entrena hoy?</label>
      <select name="alumno_id" onchange="alternarVisitante(this.value)">
        <option value="nuevo">＋ Visitante nuevo (escribir su nombre)</option>
        ${(alumnos.data || []).map(a => `<option value="${a.id}">${a.nombre}</option>`).join('')}
      </select></div>

    <div id="camposVisitante">
      <div class="campo"><label>Nombre del visitante</label>
        <input name="nombre_visitante" placeholder="Nombre y apellido"></div>
      <div class="campo"><label>Celular <span class="subtexto">(opcional)</span></label>
        ${campoTelefono('telefono_visitante', '', false)}
        <span class="subtexto">Solo si quieres invitarlo después a sacar mensualidad.
          Para un pase de un día no hace falta.</span></div>
    </div>

    <div class="fila">
      <div class="campo"><label>Fecha</label>
        <input type="date" name="fecha" required value="${util.hoy()}"></div>
      <div class="campo"><label>Monto Bs.</label>
        <input type="number" name="monto" min="0" step="0.01" required value="${precioSugerido}"></div>
    </div>

    <div class="campo"><label>Clase / horario <span class="subtexto">(opcional)</span></label>
      <select name="horario_id">
        <option value="">— Entrada libre, sin clase fija —</option>
        ${(horarios.data || []).map(h =>
          `<option value="${h.id}">${h.disciplinas?.nombre || ''} · ${h.dias} ${h.hora_inicio}</option>`).join('')}
      </select></div>

    <div class="fila">
      <div class="campo"><label>Método de pago</label>
        <select name="metodo_pago">
          <option>Efectivo</option><option>QR</option><option>Tarjeta</option><option>Transferencia</option>
        </select></div>
      <div class="campo"><label>Observación <span class="subtexto">(opcional)</span></label>
        <input name="observacion" placeholder="Ej. vino con un amigo"></div>
    </div>
  `, async (form) => {
    let alumnoId = form.alumno_id.value;

    // Visitante nuevo: basta con el nombre. El teléfono es opcional
    // porque alguien que viene un solo día no necesita avisos.
    if (alumnoId === 'nuevo') {
      const nombre = form.nombre_visitante.value.trim();
      if (!nombre) throw new Error('Escribe el nombre del visitante.');
      const telefono = validarTelefono(form.telefono_visitante.value, false);

      // Código VIS- para distinguirlos de los alumnos con mensualidad
      const nuevo = verificar(await db.from('alumnos').insert({
        codigo: await siguienteCodigo('alumnos', 'VIS'),
        nombre, telefono,
      }).select('id').single());
      alumnoId = nuevo.id;
    }

    const id = verificar(await db.rpc('crear_pase_dia', {
      p_alumno_id: Number(alumnoId),
      p_fecha: form.fecha.value,
      p_horario_id: form.horario_id.value ? Number(form.horario_id.value) : null,
      p_monto: Number(form.monto.value),
      p_metodo_pago: form.metodo_pago.value,
      p_observacion: form.observacion.value.trim(),
      p_usuario_nombre: perfilActual?.nombre || '',
    }));

    notificar(`Pase del día registrado (PD-${id}).`);
    abrirModulo('pases');
  }, 'Registrar pase');

  alternarVisitante('nuevo');
}

/** Muestra u oculta los campos del visitante según la elección. */
function alternarVisitante(valor) {
  const caja = document.getElementById('camposVisitante');
  if (caja) caja.style.display = (valor === 'nuevo') ? 'block' : 'none';
}

async function eliminarPase(id) {
  if (!confirmar('¿Eliminar este pase del día?\n\nTambién se borra su cobro de los reportes.')) return;
  const r = await db.rpc('eliminar_pase_dia', { p_pase_id: id });
  if (r.error) { notificar(r.error.message, true); return; }
  notificar('Pase eliminado.');
  abrirModulo('pases');
}
