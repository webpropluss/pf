// ============================================================
// PRIME FIT · Módulo Alumnos (con foto en Supabase Storage)
// Ficha mínima: nombre, teléfono (para el aviso de WhatsApp),
// fecha de nacimiento opcional y foto opcional.
// ============================================================

async function cargarAlumnos(contenido) {
  const alumnos = verificar(await db.from('alumnos').select('*').order('id'));

  const filas = (lista) => lista.map(a => `
    <tr>
      <td>${avatarHtml(a.nombre, a.foto_url)}</td>
      <td><strong>${a.nombre}</strong>
          <div class="subtexto">${a.codigo}${String(a.codigo||'').startsWith('VIS')
            ? ' · <span class="pill pill-amarillo">Visitante</span>' : ''}</div></td>
      <td>${telefonoMostrar(a.telefono)}</td>
      <td>${a.fecha_nacimiento ? edadDe(a.fecha_nacimiento) + ' años' : '—'}</td>
      <td>${a.activo ? '<span class="pill pill-verde">Activo</span>' : '<span class="pill pill-rojo">Inactivo</span>'}</td>
      <td class="acciones">
        <button title="Editar" onclick="dialogoAlumno(${a.id})">✏️</button>
        <button title="${a.activo ? 'Dar de baja (se puede reactivar)' : 'Reactivar'}"
                onclick="alternarAlumno(${a.id}, ${a.activo})">${a.activo ? '🚫' : '♻️'}</button>
        <button title="Eliminar definitivamente" onclick="eliminarAlumno(${a.id})">🗑️</button>
      </td>
    </tr>`).join('');

  const esVisitante = (a) => String(a.codigo || '').startsWith('VIS');
  const nMens = alumnos.filter(a => !esVisitante(a)).length;
  const nVis  = alumnos.filter(esVisitante).length;

  contenido.innerHTML = `
    <header class="cabecera"><h2>Alumnos</h2></header>
    <div class="toolbar">
      <input type="search" id="buscarAlumno" placeholder="Buscar por nombre o teléfono…">
      <select id="filtroTipo">
        <option value="todos">Todos (${alumnos.length})</option>
        <option value="mensualidad">Con mensualidad (${nMens})</option>
        <option value="visitantes">Visitantes de pase del día (${nVis})</option>
      </select>
      <button class="btn btn-rojo" onclick="dialogoAlumno()">＋ Nuevo alumno</button>
    </div>
    <div class="panel">
      <table>
        <thead><tr><th></th><th>Nombre</th><th>Teléfono</th><th>Edad</th><th>Estado</th><th></th></tr></thead>
        <tbody id="tbodyAlumnos">${filas(alumnos)}</tbody>
      </table>
      <p class="subtexto" style="margin-top:12px">
        🚫 da de baja (se guarda su historial y se puede reactivar) ·
        🗑️ elimina al alumno para siempre.
      </p>
    </div>`;

  const repintar = () => {
    const q = document.getElementById('buscarAlumno').value.toLowerCase();
    const tipo = document.getElementById('filtroTipo').value;
    document.getElementById('tbodyAlumnos').innerHTML = filas(alumnos.filter(a =>
      (a.nombre + a.telefono + a.codigo).toLowerCase().includes(q) &&
      (tipo === 'todos' ||
       (tipo === 'visitantes' ?  esVisitante(a) : !esVisitante(a)))));
  };
  document.getElementById('buscarAlumno').addEventListener('input', repintar);
  document.getElementById('filtroTipo').addEventListener('change', repintar);
}

function edadDe(fecha) {
  if (!fecha) return '—';
  const n = new Date(fecha + 'T00:00:00'), hoy = new Date();
  let e = hoy.getFullYear() - n.getFullYear();
  if (hoy < new Date(hoy.getFullYear(), n.getMonth(), n.getDate())) e--;
  return Math.max(e, 0);
}

async function dialogoAlumno(id) {
  const a = id
    ? verificar(await db.from('alumnos').select('*').eq('id', id).single())
    : { nombre: '', telefono: '', fecha_nacimiento: '', foto_url: null };

  abrirModal(id ? 'Editar alumno' : 'Nuevo alumno', `
    <div class="campo"><label>Nombre completo</label>
      <input name="nombre" required value="${a.nombre}"></div>
    <div class="campo"><label>Celular (WhatsApp)</label>
      ${campoTelefono('telefono', a.telefono, true)}
      <span class="subtexto">Solo los 8 dígitos. Se usa para avisarle cuando su mensualidad esté por vencer.</span></div>
    <div class="campo"><label>Fecha de nacimiento <span class="subtexto">(opcional)</span></label>
      <input type="date" name="fecha_nacimiento" value="${a.fecha_nacimiento || ''}"></div>
    <div class="campo"><label>Foto <span class="subtexto">(opcional)</span></label>
      <input type="file" name="foto" accept="image/*"></div>
  `, async (form) => {
    const telefono = validarTelefono(form.telefono.value);   // agrega el 591 solo

    const datos = {
      nombre: form.nombre.value.trim(),
      telefono,
      fecha_nacimiento: form.fecha_nacimiento.value || null,
    };

    // Subir la foto a Supabase Storage si se eligió una
    const archivo = form.foto.files[0];
    if (archivo) {
      const ruta = `alumno_${Date.now()}.${archivo.name.split('.').pop()}`;
      const sub = await db.storage.from('fotos-alumnos').upload(ruta, archivo, { upsert: true });
      if (sub.error) throw new Error('No se pudo subir la foto: ' + sub.error.message);
      datos.foto_url = db.storage.from('fotos-alumnos').getPublicUrl(ruta).data.publicUrl;
    }

    if (id) {
      verificar(await db.from('alumnos').update(datos).eq('id', id));
    } else {
      datos.codigo = await siguienteCodigo('alumnos', 'ALU');
      verificar(await db.from('alumnos').insert(datos));
    }
    notificar(id ? 'Alumno actualizado.' : 'Alumno registrado.');
    abrirModulo('alumnos');
  });
}

/** Baja temporal: conserva el historial y se puede reactivar. */
async function alternarAlumno(id, activo) {
  if (activo && !confirmar('¿Dar de baja a este alumno?\n\nSe guarda todo su historial y lo puedes reactivar cuando vuelva.')) return;
  verificar(await db.from('alumnos').update({ activo: !activo }).eq('id', id));
  notificar(activo ? 'Alumno dado de baja.' : 'Alumno reactivado.');
  abrirModulo('alumnos');
}

/**
 * Eliminación definitiva. Primero consulta qué historial tiene el alumno;
 * si tiene movimientos pide una segunda confirmación antes de borrar todo.
 */
async function eliminarAlumno(id) {
  const alumno = verificar(await db.from('alumnos').select('nombre, foto_url').eq('id', id).single());

  // ¿Qué historial tiene?
  const resumen = verificar(await db.rpc('historial_alumno', { p_alumno_id: id }));
  const h = Array.isArray(resumen) ? resumen[0] : resumen;
  const total = (h?.inscripciones || 0) + (h?.pagos || 0) + (h?.asistencias || 0) + (h?.pases || 0);

  if (total === 0) {
    if (!confirmar(`¿Eliminar a ${alumno.nombre} para siempre?\n\nNo tiene ningún movimiento registrado.`)) return;
  } else {
    const detalle = [
      h.inscripciones ? `• ${h.inscripciones} inscripción(es)` : null,
      h.pagos         ? `• ${h.pagos} pago(s)` : null,
      h.asistencias   ? `• ${h.asistencias} asistencia(s)` : null,
      h.pases         ? `• ${h.pases} pase(s) del día` : null,
    ].filter(Boolean).join('\n');

    if (!confirmar(
      `⚠ ${alumno.nombre} TIENE HISTORIAL:\n\n${detalle}\n\n` +
      `Al eliminarlo se borra TODO eso y no se puede recuperar.\n` +
      `Las plazas que ocupaba en las clases quedarán libres.\n\n` +
      `Si solo quiere dejar de venir, usa 🚫 Dar de baja.\n\n¿Eliminar de todas formas?`)) return;

    if (!confirmar(`Última confirmación: se eliminará a ${alumno.nombre} y sus ${total} registro(s).`)) return;
  }

  const r = await db.rpc('eliminar_alumno', { p_alumno_id: id });
  if (r.error) { notificar(r.error.message, true); return; }

  // Borrar también su foto del almacenamiento (si tenía)
  if (alumno.foto_url) {
    const archivo = alumno.foto_url.split('/').pop();
    if (archivo) await db.storage.from('fotos-alumnos').remove([archivo]);
  }

  notificar(`${alumno.nombre} fue eliminado.`);
  abrirModulo('alumnos');
}
