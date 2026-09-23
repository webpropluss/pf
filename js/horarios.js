// ============================================================
// PRIME FIT · Módulo Horarios (cupo = "stock" de la clase)
// ============================================================

function estadoHorario(h) {
  const disp = Math.max(h.cupo - h.inscritos, 0);
  if (disp <= 0) return '<span class="pill pill-rojo">Lleno</span>';
  if (disp <= Math.max(1, Math.round(h.cupo * 0.15))) return '<span class="pill pill-amarillo">Casi lleno</span>';
  return '<span class="pill pill-verde">Disponible</span>';
}

async function cargarHorarios(contenido) {
  const horarios = verificar(await db.from('horarios')
    .select('*, disciplinas(nombre), instructores(nombre)').order('id'));

  contenido.innerHTML = `
    <header class="cabecera"><h2>Horarios</h2></header>
    <div class="toolbar">
      <button class="btn btn-rojo" onclick="dialogoHorario()">＋ Nuevo horario</button>
    </div>
    <div class="panel">
      <table>
        <thead><tr><th>Disciplina</th><th>Días</th><th>Hora</th><th>Sala</th><th>Instructor</th><th>Cupo</th><th>Inscritos</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${horarios.map(h => `
            <tr>
              <td><strong>${h.disciplinas?.nombre || '—'}</strong></td>
              <td>${h.dias}</td>
              <td>${h.hora_inicio} – ${h.hora_fin}</td>
              <td>${h.sala}</td>
              <td>${h.instructores?.nombre || '—'}</td>
              <td>${h.cupo}</td>
              <td>${h.inscritos}</td>
              <td>${h.activo ? estadoHorario(h) : '<span class="pill pill-rojo">Inactivo</span>'}</td>
              <td class="acciones">
                <button title="Editar" onclick="dialogoHorario(${h.id})">✏️</button>
                <button title="Ajustar cupo" onclick="dialogoAjusteCupo(${h.id}, ${h.cupo}, ${h.inscritos})">🎚️</button>
                <button title="${h.activo ? 'Desactivar (se puede reactivar)' : 'Reactivar'}" onclick="alternarHorario(${h.id}, ${h.activo})">${h.activo ? '🚫' : '♻️'}</button>
                <button title="Eliminar definitivamente" onclick="eliminarHorario(${h.id})">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function dialogoHorario(id) {
  const [disciplinas, instructores] = await Promise.all([
    db.from('disciplinas').select('id, nombre').eq('activo', true).order('nombre'),
    db.from('instructores').select('id, nombre').eq('activo', true).order('nombre'),
  ]);
  const h = id
    ? verificar(await db.from('horarios').select('*').eq('id', id).single())
    : { disciplina_id: '', instructor_id: '', dias: 'Lun-Vie', hora_inicio: '07:00', hora_fin: '08:00', sala: 'Sala 1', cupo: 20 };

  const opciones = (lista, sel) => lista.map(x =>
    `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${x.nombre}</option>`).join('');

  abrirModal(id ? 'Editar horario' : 'Nuevo horario', `
    <div class="fila">
      <div class="campo"><label>Disciplina</label>
        <select name="disciplina_id" required>${opciones(disciplinas.data || [], h.disciplina_id)}</select></div>
      <div class="campo"><label>Instructor</label>
        <select name="instructor_id" required>${opciones(instructores.data || [], h.instructor_id)}</select></div>
    </div>
    <div class="fila">
      <div class="campo"><label>Días</label>
        <select name="dias">
          ${['Lun-Vie','Lun-Mié-Vie','Mar-Jue','Sáb','Dom','Todos los días']
            .map(d => `<option ${d === h.dias ? 'selected' : ''}>${d}</option>`).join('')}
        </select></div>
      <div class="campo"><label>Sala</label><input name="sala" value="${h.sala}"></div>
    </div>
    <div class="fila">
      <div class="campo"><label>Hora inicio</label><input type="time" name="hora_inicio" required value="${h.hora_inicio}"></div>
      <div class="campo"><label>Hora fin</label><input type="time" name="hora_fin" required value="${h.hora_fin}"></div>
    </div>
    <div class="campo"><label>Cupo (plazas)</label>
      <input type="number" name="cupo" min="1" required value="${h.cupo}"></div>
  `, async (form) => {
    const datos = {
      disciplina_id: Number(form.disciplina_id.value),
      instructor_id: Number(form.instructor_id.value),
      dias: form.dias.value,
      sala: form.sala.value.trim(),
      hora_inicio: form.hora_inicio.value,
      hora_fin: form.hora_fin.value,
      cupo: Number(form.cupo.value),
    };
    if (id) verificar(await db.from('horarios').update(datos).eq('id', id));
    else verificar(await db.from('horarios').insert(datos));
    notificar('Horario guardado.');
    abrirModulo('horarios');
  });
}

/** Ajuste manual de plazas: cambia el cupo y lo registra en la bitácora. */
async function dialogoAjusteCupo(id, cupo, inscritos) {
  abrirModal('Ajustar cupo de la clase', `
    <p class="subtexto" style="margin-bottom:14px">
      Cupo actual: <strong>${cupo}</strong> · Inscritos: <strong>${inscritos}</strong></p>
    <div class="campo"><label>Nuevo cupo</label>
      <input type="number" name="cupo" min="${inscritos}" required value="${cupo}"></div>
    <div class="campo"><label>Motivo del ajuste</label>
      <input name="motivo" required placeholder="Ej. se amplió la sala"></div>
  `, async (form) => {
    const nuevo = Number(form.cupo.value);
    if (nuevo < inscritos) throw new Error('El cupo no puede ser menor a los inscritos actuales.');
    verificar(await db.from('horarios').update({ cupo: nuevo }).eq('id', id));
    verificar(await db.from('movimientos_cupo').insert({
      horario_id: id, tipo: 'ajuste', cantidad: nuevo - cupo,
      inscritos_resultante: inscritos, motivo: form.motivo.value.trim(),
      referencia: 'Ajuste manual',
    }));
    notificar('Cupo ajustado.');
    abrirModulo('horarios');
  }, 'Ajustar');
}

/** Elimina el horario si no tiene inscripciones. */
async function eliminarHorario(id) {
  const r = verificar(await db.rpc('usos_horario', { p_id: id }));
  const u = Array.isArray(r) ? r[0] : r;

  if ((u?.inscripciones || 0) > 0) {
    notificar(`No se puede eliminar: este horario tiene ${u.inscripciones} inscripción(es). ` +
              'Elimínalas primero desde Inscripciones, o usa 🚫 Desactivar.', true);
    return;
  }

  const avisos = [
    u?.asistencias ? `• se borrarán ${u.asistencias} registro(s) de asistencia` : null,
    u?.pases ? `• ${u.pases} pase(s) del día quedarán como "entrada libre"` : null,
  ].filter(Boolean);

  const mensaje = avisos.length
    ? `¿Eliminar este horario para siempre?\n\n${avisos.join('\n')}`
    : '¿Eliminar este horario para siempre?';
  if (!confirmar(mensaje)) return;

  const del = await db.rpc('eliminar_horario', { p_id: id });
  if (del.error) { notificar(del.error.message, true); return; }
  notificar('Horario eliminado.');
  abrirModulo('horarios');
}

async function alternarHorario(id, activo) {
  verificar(await db.from('horarios').update({ activo: !activo }).eq('id', id));
  abrirModulo('horarios');
}
