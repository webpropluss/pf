// ============================================================
// PRIME FIT · Módulo Asistencia
// Se elige fecha y clase, y se pasa lista de los alumnos con
// inscripción vigente en ese horario.
// ============================================================

async function cargarAsistencia(contenido) {
  const horarios = verificar(await db.from('horarios')
    .select('id, dias, hora_inicio, disciplinas(nombre)').eq('activo', true).order('id'));

  contenido.innerHTML = `
    <header class="cabecera"><h2>Asistencia</h2></header>
    <div class="toolbar">
      <input type="date" id="asisFecha" value="${util.hoy()}">
      <select id="asisHorario">
        <option value="">— Elegir clase —</option>
        ${horarios.map(h => `<option value="${h.id}">${h.disciplinas?.nombre} · ${h.dias} ${h.hora_inicio}</option>`).join('')}
      </select>
      <button class="btn btn-rojo" onclick="pasarLista()">Pasar lista</button>
    </div>
    <div id="listaAsistencia" class="panel">
      <p class="cargando">Elige la fecha y la clase para ver a los alumnos inscritos.</p>
    </div>`;
}

async function pasarLista() {
  const fecha = document.getElementById('asisFecha').value;
  const horarioId = Number(document.getElementById('asisHorario').value);
  const cont = document.getElementById('listaAsistencia');
  if (!fecha || !horarioId) { notificar('Elige la fecha y la clase.', true); return; }
  cont.innerHTML = '<p class="cargando">Cargando alumnos…</p>';

  // Alumnos con inscripción vigente (no anulada) en ese horario y esa fecha
  const detalles = verificar(await db.from('inscripcion_detalles')
    .select('inscripciones!inner(alumno_id, anulada, fecha_inicio, fecha_fin, alumnos(id, nombre, foto_url))')
    .eq('horario_id', horarioId)
    .eq('inscripciones.anulada', false)
    .lte('inscripciones.fecha_inicio', fecha)
    .gte('inscripciones.fecha_fin', fecha));

  // Un alumno puede aparecer una sola vez
  const alumnos = [];
  const vistos = new Set();
  detalles.forEach(d => {
    const a = d.inscripciones?.alumnos;
    if (a && !vistos.has(a.id)) { vistos.add(a.id); alumnos.push(a); }
  });

  if (!alumnos.length) {
    cont.innerHTML = '<p class="cargando">No hay alumnos con inscripción vigente en esta clase para esa fecha.</p>';
    return;
  }

  // Asistencias ya guardadas para esa fecha y clase
  const previas = verificar(await db.from('asistencias')
    .select('alumno_id, presente').eq('fecha', fecha).eq('horario_id', horarioId));
  const estadoDe = {};
  previas.forEach(p => estadoDe[p.alumno_id] = p.presente);

  cont.innerHTML = `
    <h3>Lista · ${util.fecha(fecha)} (${alumnos.length} alumnos)</h3>
    <table>
      <thead><tr><th></th><th>Alumno</th><th style="width:120px">Presente</th></tr></thead>
      <tbody>
        ${alumnos.map(a => `
          <tr>
            <td>${avatarHtml(a.nombre, a.foto_url)}</td>
            <td><strong>${a.nombre}</strong></td>
            <td><input type="checkbox" class="check-grande" data-alumno="${a.id}"
                 ${estadoDe[a.id] === undefined || estadoDe[a.id] ? 'checked' : ''}></td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div style="margin-top:16px; display:flex; justify-content:flex-end">
      <button class="btn btn-rojo" onclick="guardarAsistencia('${fecha}', ${horarioId})">Guardar asistencia</button>
    </div>`;
}

async function guardarAsistencia(fecha, horarioId) {
  const filas = [...document.querySelectorAll('#listaAsistencia input[data-alumno]')].map(c => ({
    fecha, horario_id: horarioId,
    alumno_id: Number(c.dataset.alumno),
    presente: c.checked,
  }));
  const r = await db.from('asistencias').upsert(filas, { onConflict: 'fecha,alumno_id,horario_id' });
  if (r.error) { notificar(r.error.message, true); return; }
  notificar(`Asistencia guardada: ${filas.filter(f => f.presente).length}/${filas.length} presentes.`);
}
