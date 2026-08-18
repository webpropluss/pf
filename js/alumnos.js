// ============================================================
// PRIME FIT · Módulo Alumnos (con foto en Supabase Storage)
// ============================================================

async function cargarAlumnos(contenido) {
  const alumnos = verificar(await db.from('alumnos').select('*').order('id'));

  const filas = (lista) => lista.map(a => `
    <tr>
      <td>${avatarHtml(a.nombre, a.foto_url)}</td>
      <td><strong>${a.nombre}</strong><div class="subtexto">${a.codigo}</div></td>
      <td>${a.dni || '—'}</td>
      <td>${a.telefono || '—'}</td>
      <td>${edadDe(a.fecha_nacimiento)} años</td>
      <td>${a.activo ? '<span class="pill pill-verde">Activo</span>' : '<span class="pill pill-rojo">Inactivo</span>'}</td>
      <td class="acciones">
        <button title="Editar" onclick="dialogoAlumno(${a.id})">✏️</button>
        <button title="${a.activo ? 'Dar de baja' : 'Reactivar'}" onclick="alternarAlumno(${a.id}, ${a.activo})">${a.activo ? '🚫' : '♻️'}</button>
      </td>
    </tr>`).join('');

  contenido.innerHTML = `
    <header class="cabecera"><h2>Alumnos</h2></header>
    <div class="toolbar">
      <input type="search" id="buscarAlumno" placeholder="Buscar por nombre, DNI o teléfono…">
      <button class="btn btn-rojo" onclick="dialogoAlumno()">＋ Nuevo alumno</button>
    </div>
    <div class="panel">
      <table>
        <thead><tr><th></th><th>Nombre</th><th>DNI</th><th>Teléfono</th><th>Edad</th><th>Estado</th><th></th></tr></thead>
        <tbody id="tbodyAlumnos">${filas(alumnos)}</tbody>
      </table>
    </div>`;

  document.getElementById('buscarAlumno').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.getElementById('tbodyAlumnos').innerHTML = filas(
      alumnos.filter(a => (a.nombre + a.dni + a.telefono + a.codigo).toLowerCase().includes(q)));
  });
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
    : { nombre: '', dni: '', telefono: '', fecha_nacimiento: '2000-01-01', direccion: '', foto_url: null };

  abrirModal(id ? 'Editar alumno' : 'Nuevo alumno', `
    <div class="campo"><label>Nombre completo</label><input name="nombre" required value="${a.nombre}"></div>
    <div class="fila">
      <div class="campo"><label>DNI / CI</label><input name="dni" value="${a.dni || ''}"></div>
      <div class="campo"><label>Teléfono (WhatsApp, con código de país)</label>
        <input name="telefono" placeholder="59171234567" value="${a.telefono || ''}"></div>
    </div>
    <div class="campo"><label>Fecha de nacimiento</label><input type="date" name="fecha_nacimiento" value="${a.fecha_nacimiento || ''}"></div>
    <div class="campo"><label>Dirección</label><input name="direccion" value="${a.direccion || ''}"></div>
    <div class="campo"><label>Foto (opcional)</label><input type="file" name="foto" accept="image/*"></div>
  `, async (form) => {
    const datos = {
      nombre: form.nombre.value.trim(),
      dni: form.dni.value.trim(),
      telefono: form.telefono.value.replace(/[^\d]/g, ''),
      fecha_nacimiento: form.fecha_nacimiento.value || null,
      direccion: form.direccion.value.trim(),
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

async function alternarAlumno(id, activo) {
  if (activo && !confirmar('¿Dar de baja a este alumno?')) return;
  verificar(await db.from('alumnos').update({ activo: !activo }).eq('id', id));
  notificar(activo ? 'Alumno dado de baja.' : 'Alumno reactivado.');
  abrirModulo('alumnos');
}
