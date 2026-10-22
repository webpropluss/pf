// ============================================================
// PRIME FIT · Módulos Disciplinas e Instructores
// ============================================================

// ---------------------- DISCIPLINAS ----------------------

async function cargarDisciplinas(contenido) {
  const lista = verificar(await db.from('disciplinas').select('*').order('id'));

  contenido.innerHTML = `
    <header class="cabecera"><h2>Disciplinas</h2></header>
    <div class="toolbar">
      <button class="btn btn-rojo" onclick="dialogoDisciplina()">＋ Nueva disciplina</button>
    </div>
    <div class="panel">
      <table>
        <thead><tr><th>Código</th><th>Nombre</th><th>Descripción</th><th>Precio mensual</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${lista.map(d => `
            <tr>
              <td>${d.codigo}</td>
              <td><strong>${d.nombre}</strong></td>
              <td>${d.descripcion || '—'}</td>
              <td>${util.bs(d.precio_mensual)}</td>
              <td>${d.activo ? '<span class="pill pill-verde">Activa</span>' : '<span class="pill pill-rojo">Inactiva</span>'}</td>
              <td class="acciones">
                <button title="Editar" onclick="dialogoDisciplina(${d.id})">✏️</button>
                <button title="${d.activo ? 'Desactivar (se puede reactivar)' : 'Reactivar'}" onclick="alternarDisciplina(${d.id}, ${d.activo})">${d.activo ? '🚫' : '♻️'}</button>
                <button title="Eliminar definitivamente" onclick="eliminarDisciplina(${d.id}, '${d.nombre.replace(/'/g, '')}')">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function dialogoDisciplina(id) {
  const d = id
    ? verificar(await db.from('disciplinas').select('*').eq('id', id).single())
    : { nombre: '', descripcion: '', precio_mensual: 0 };

  abrirModal(id ? 'Editar disciplina' : 'Nueva disciplina', `
    <div class="campo"><label>Nombre</label><input name="nombre" required value="${d.nombre}"></div>
    <div class="campo"><label>Descripción</label><input name="descripcion" value="${d.descripcion || ''}"></div>
    <div class="campo"><label>Precio mensual (Bs.)</label>
      <input type="number" name="precio" min="0" step="0.01" required value="${d.precio_mensual}"></div>
  `, async (form) => {
    const datos = {
      nombre: form.nombre.value.trim(),
      descripcion: form.descripcion.value.trim(),
      precio_mensual: Number(form.precio.value),
    };
    if (id) verificar(await db.from('disciplinas').update(datos).eq('id', id));
    else {
      await insertarConCodigo('disciplinas', 'DIS', datos);
    }
    notificar('Disciplina guardada.');
    abrirModulo('disciplinas');
  });
}

/** Elimina la disciplina si nada la está usando. */
async function eliminarDisciplina(id, nombre) {
  const r = verificar(await db.rpc('usos_disciplina', { p_id: id }));
  const u = Array.isArray(r) ? r[0] : r;

  if ((u?.horarios || 0) + (u?.inscripciones || 0) > 0) {
    notificar(
      `No se puede eliminar "${nombre}": ` +
      [u.horarios ? `${u.horarios} horario(s)` : null,
       u.inscripciones ? `${u.inscripciones} inscripción(es)` : null]
        .filter(Boolean).join(' y ') + ' la están usando. Bórralos primero o usa 🚫 Desactivar.', true);
    return;
  }
  if (!confirmar(`¿Eliminar la disciplina "${nombre}" para siempre?`)) return;

  const del = await db.rpc('eliminar_disciplina', { p_id: id });
  if (del.error) { notificar(del.error.message, true); return; }
  notificar('Disciplina eliminada.');
  abrirModulo('disciplinas');
}

async function alternarDisciplina(id, activo) {
  verificar(await db.from('disciplinas').update({ activo: !activo }).eq('id', id));
  abrirModulo('disciplinas');
}

// ---------------------- INSTRUCTORES ----------------------

async function cargarInstructores(contenido) {
  const [instructores, horarios] = await Promise.all([
    db.from('instructores').select('*').order('id'),
    db.from('horarios').select('instructor_id').eq('activo', true),
  ]);
  const clasesPor = {};
  (horarios.data || []).forEach(h => clasesPor[h.instructor_id] = (clasesPor[h.instructor_id] || 0) + 1);

  contenido.innerHTML = `
    <header class="cabecera"><h2>Instructores</h2></header>
    <div class="toolbar">
      <button class="btn btn-rojo" onclick="dialogoInstructor()">＋ Nuevo instructor</button>
    </div>
    <div class="panel">
      <table>
        <thead><tr><th>Código</th><th>Nombre</th><th>Teléfono</th><th>Especialidad</th><th>Porcentaje</th><th>Clases asignadas</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${(instructores.data || []).map(i => `
            <tr>
              <td>${i.codigo}</td>
              <td><strong>${i.nombre}</strong></td>
              <td>${telefonoMostrar(i.telefono)}</td>
              <td>${i.especialidad || '—'}</td>
              <td>${i.porcentaje != null && Number(i.porcentaje) > 0
                    ? `<strong>${Number(i.porcentaje)}%</strong>`
                    : '<span class="pill pill-amarillo">Sin definir</span>'}</td>
              <td>${clasesPor[i.id] || 0}</td>
              <td>${i.activo ? '<span class="pill pill-verde">Activo</span>' : '<span class="pill pill-rojo">Inactivo</span>'}</td>
              <td class="acciones">
                <button title="Editar" onclick="dialogoInstructor(${i.id})">✏️</button>
                <button title="${i.activo ? 'Desactivar (se puede reactivar)' : 'Reactivar'}" onclick="alternarInstructor(${i.id}, ${i.activo})">${i.activo ? '🚫' : '♻️'}</button>
                <button title="Eliminar definitivamente" onclick="eliminarInstructor(${i.id}, '${i.nombre.replace(/'/g, '')}')">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function dialogoInstructor(id) {
  const i = id
    ? verificar(await db.from('instructores').select('*').eq('id', id).single())
    : { nombre: '', telefono: '', especialidad: '', porcentaje: '' };

  abrirModal(id ? 'Editar instructor' : 'Nuevo instructor', `
    <div class="campo"><label>Nombre</label><input name="nombre" required value="${i.nombre}"></div>
    <div class="fila">
      <div class="campo"><label>Celular</label>${campoTelefono('telefono', i.telefono, false)}</div>
      <div class="campo"><label>Especialidad</label><input name="especialidad" value="${i.especialidad || ''}"></div>
    </div>
    <div class="campo"><label>Porcentaje del instructor (%)</label>
      <input type="number" name="porcentaje" min="0" max="100" step="0.5" placeholder="Ej. 50"
             value="${i.porcentaje ?? ''}" oninput="avisoPorcentaje(this)">
      <span class="subtexto" id="avisoPorcentaje">Parte de lo cobrado por sus clases
        (inscripciones y pases del día) que le corresponde a él.</span></div>
  `, async (form) => {
    const pct = form.porcentaje.value === '' ? 0 : Number(form.porcentaje.value);
    if (isNaN(pct) || pct < 0 || pct > 100) throw new Error('El porcentaje va de 0 a 100.');
    const datos = {
      nombre: form.nombre.value.trim(),
      telefono: validarTelefono(form.telefono.value, false),
      especialidad: form.especialidad.value.trim(),
      porcentaje: pct,
    };
    if (id) verificar(await db.from('instructores').update(datos).eq('id', id));
    else {
      await insertarConCodigo('instructores', 'INS', datos);
    }
    notificar('Instructor guardado.');
    abrirModulo('instructores');
  });
  avisoPorcentaje(document.querySelector('#formModal [name="porcentaje"]'));
}

/** Muestra cómo se reparte cada Bs. 100 mientras se escribe el porcentaje. */
function avisoPorcentaje(campo) {
  const aviso = document.getElementById('avisoPorcentaje');
  if (!campo || !aviso || campo.value === '') return;
  const p = Number(campo.value);
  if (isNaN(p) || p < 0 || p > 100) {
    aviso.innerHTML = '<span style="color:#ff8a8f">Debe estar entre 0 y 100.</span>';
    return;
  }
  aviso.innerHTML = `De cada <strong>Bs. 100</strong> cobrados por sus clases:
    <strong>${util.bs(p)}</strong> para el instructor y
    <strong style="color:var(--verde)">${util.bs(100 - p)}</strong> para Prime Fit.`;
}

/** Elimina el instructor si no tiene clases asignadas. */
async function eliminarInstructor(id, nombre) {
  const r = verificar(await db.rpc('usos_instructor', { p_id: id }));
  const u = Array.isArray(r) ? r[0] : r;

  if ((u?.horarios || 0) > 0) {
    notificar(`No se puede eliminar a ${nombre}: está asignado a ${u.horarios} clase(s). ` +
              'Cámbiales de instructor o elimina esos horarios primero.', true);
    return;
  }
  if (!confirmar(`¿Eliminar al instructor ${nombre} para siempre?`)) return;

  const del = await db.rpc('eliminar_instructor', { p_id: id });
  if (del.error) { notificar(del.error.message, true); return; }
  notificar('Instructor eliminado.');
  abrirModulo('instructores');
}

async function alternarInstructor(id, activo) {
  verificar(await db.from('instructores').update({ activo: !activo }).eq('id', id));
  abrirModulo('instructores');
}
