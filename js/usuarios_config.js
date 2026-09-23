// ============================================================
// PRIME FIT · Módulos Usuarios y Configuración (solo administrador)
// ============================================================

// ---------------------- USUARIOS ----------------------
// Nota: la CUENTA (email + contraseña) se crea en Supabase →
// Authentication → Users. Aquí se administra el nombre, rol y estado.

async function cargarUsuarios(contenido) {
  const perfiles = verificar(await db.from('perfiles').select('*').order('nombre'));

  contenido.innerHTML = `
    <header class="cabecera"><h2>Usuarios</h2></header>
    <div class="panel">
      <p class="subtexto" style="margin-bottom:14px">
        Para crear una cuenta nueva: panel de Supabase → <strong>Authentication → Users → Add user</strong>.
        La cuenta aparecerá aquí al asignarle un rol con el botón ＋ de abajo.</p>
      <table>
        <thead><tr><th>Nombre</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${perfiles.map(p => `
            <tr>
              <td><strong>${p.nombre}</strong></td>
              <td>${p.rol}</td>
              <td>${p.activo ? '<span class="pill pill-verde">Activo</span>' : '<span class="pill pill-rojo">Inactivo</span>'}</td>
              <td class="acciones">
                <button title="Editar" onclick="dialogoPerfil('${p.id}')">✏️</button>
                <button title="${p.activo ? 'Desactivar' : 'Reactivar'}" onclick="alternarPerfil('${p.id}', ${p.activo})">${p.activo ? '🚫' : '♻️'}</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div style="margin-top:14px">
        <button class="btn btn-oscuro" onclick="dialogoPerfilNuevo()">＋ Asignar rol a una cuenta nueva</button>
      </div>
    </div>`;
}

async function dialogoPerfil(id) {
  const p = verificar(await db.from('perfiles').select('*').eq('id', id).single());
  abrirModal('Editar usuario', `
    <div class="campo"><label>Nombre</label><input name="nombre" required value="${p.nombre}"></div>
    <div class="campo"><label>Rol</label>
      <select name="rol">
        ${['Administrador','Recepcionista','Cajero','Instructor']
          .map(r => `<option ${r === p.rol ? 'selected' : ''}>${r}</option>`).join('')}
      </select></div>
  `, async (form) => {
    verificar(await db.from('perfiles').update({
      nombre: form.nombre.value.trim(), rol: form.rol.value,
    }).eq('id', id));
    notificar('Usuario actualizado.');
    abrirModulo('usuarios');
  });
}

/** Asigna nombre y rol a una cuenta ya creada en Authentication (por su email). */
function dialogoPerfilNuevo() {
  abrirModal('Asignar rol a una cuenta', `
    <p class="subtexto" style="margin-bottom:14px">
      La cuenta ya debe existir en Authentication → Users.</p>
    <div class="campo"><label>Email de la cuenta</label>
      <input type="email" name="email" required placeholder="nuevo@primefit.com"></div>
    <div class="campo"><label>Nombre</label><input name="nombre" required></div>
    <div class="campo"><label>Rol</label>
      <select name="rol"><option>Recepcionista</option><option>Cajero</option><option>Instructor</option><option>Administrador</option></select></div>
  `, async (form) => {
    // Busca el id del usuario de Auth mediante una función SQL auxiliar
    const r = await db.rpc('id_usuario_por_email', { p_email: form.email.value.trim().toLowerCase() });
    if (r.error || !r.data) throw new Error('No existe una cuenta con ese email. Créala primero en Authentication → Users.');
    verificar(await db.from('perfiles').upsert({
      id: r.data, nombre: form.nombre.value.trim(), rol: form.rol.value, activo: true,
    }));
    notificar('Rol asignado. La cuenta ya puede usar el sistema.');
    abrirModulo('usuarios');
  }, 'Asignar');
}

async function alternarPerfil(id, activo) {
  verificar(await db.from('perfiles').update({ activo: !activo }).eq('id', id));
  abrirModulo('usuarios');
}

// ---------------------- CONFIGURACIÓN ----------------------

async function cargarConfiguracion(contenido) {
  const filas = verificar(await db.from('config').select('*'));
  const c = {};
  filas.forEach(f => c[f.clave] = f.valor);

  contenido.innerHTML = `
    <header class="cabecera"><h2>Configuración</h2></header>

    <div class="panel">
      <h3>Datos del gimnasio</h3>
      <form id="formConfig">
        <div class="fila">
          <div class="campo"><label>Nombre</label><input name="nombre_gimnasio" value="${c.nombre_gimnasio || 'Prime Fit'}"></div>
          <div class="campo"><label>Teléfono</label><input name="telefono" value="${c.telefono || ''}"></div>
        </div>
        <div class="campo"><label>Dirección</label><input name="direccion" value="${c.direccion || ''}"></div>

        <div class="campo"><label>Precio sugerido del pase del día (Bs.)</label>
          <input type="number" name="precio_pase_dia" min="0" step="0.5" value="${c.precio_pase_dia || 25}">
          <span class="subtexto">Es solo el valor que viene puesto por defecto; se puede cambiar en cada pase.</span></div>

        <h3 style="margin:18px 0 12px">📲 Aviso automático de WhatsApp</h3>
        <div class="campo"><label>Enviar el aviso cuántos días antes del vencimiento</label>
          <input type="number" name="dias_aviso_whatsapp" min="1" max="15" value="${c.dias_aviso_whatsapp || 3}"></div>
        <div class="campo"><label>Mensaje (usa {nombre} y {fecha})</label>
          <textarea name="mensaje_whatsapp" rows="4">${c.mensaje_whatsapp || ''}</textarea></div>

        <button type="submit" class="btn btn-rojo">Guardar configuración</button>
      </form>
    </div>

    <div class="panel">
      <h3>Avisos de WhatsApp enviados</h3>
      <div id="tablaAvisos"><p class="cargando">Cargando…</p></div>
    </div>`;

  document.getElementById('formConfig').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const datos = ['nombre_gimnasio','telefono','direccion','precio_pase_dia','dias_aviso_whatsapp','mensaje_whatsapp']
      .map(clave => ({ clave, valor: f[clave].value }));
    const r = await db.from('config').upsert(datos);
    if (r.error) { notificar(r.error.message, true); return; }
    notificar('Configuración guardada.');
  });

  const avisos = await db.from('avisos_whatsapp')
    .select('*, alumnos(nombre)').order('id', { ascending: false }).limit(50);
  document.getElementById('tablaAvisos').innerHTML = (avisos.data?.length) ? `
    <table>
      <thead><tr><th>Fecha</th><th>Alumno</th><th>Teléfono</th><th>Estado</th></tr></thead>
      <tbody>${avisos.data.map(a => `
        <tr>
          <td>${new Date(a.fecha_envio).toLocaleString('es-BO')}</td>
          <td>${a.alumnos?.nombre || '—'}</td>
          <td>${a.telefono}</td>
          <td>${a.estado === 'enviado'
                ? '<span class="pill pill-verde">Enviado</span>'
                : a.estado === 'error'
                ? `<span class="pill pill-rojo" title="${a.detalle_error || ''}">Error</span>`
                : '<span class="pill pill-amarillo">Pendiente</span>'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`
    : '<p class="cargando">Todavía no se envió ningún aviso. Se activan en la Etapa 5.</p>';
}
