// ============================================================
// PRIME FIT · Módulo Pagos
// ============================================================

async function cargarPagos(contenido) {
  const [inscripciones, pagos] = await Promise.all([
    db.from('inscripciones').select('*, alumnos(nombre)').eq('anulada', false).order('id', { ascending: false }),
    db.from('pagos').select('*, alumnos(nombre)').order('id', { ascending: false }),
  ]);

  const pagadoPor = {};
  (pagos.data || []).forEach(p => pagadoPor[p.inscripcion_id] = (pagadoPor[p.inscripcion_id] || 0) + Number(p.monto));

  const pendientes = (inscripciones.data || [])
    .map(i => ({ ...i, pagado: pagadoPor[i.id] || 0, saldo: Math.max(Number(i.total) - (pagadoPor[i.id] || 0), 0) }))
    .filter(i => i.saldo > 0);

  const hoy = util.hoy();
  const ingresosDia = (pagos.data || []).filter(p => String(p.fecha).slice(0, 10) === hoy)
    .reduce((s, p) => s + Number(p.monto), 0);
  const mes = hoy.slice(0, 7);
  const ingresosMes = (pagos.data || []).filter(p => String(p.fecha).slice(0, 7) === mes)
    .reduce((s, p) => s + Number(p.monto), 0);

  const esAdmin = puedeAccion('eliminarPago');

  contenido.innerHTML = `
    <header class="cabecera"><h2>Pagos</h2></header>

    <div class="tarjetas">
      <div class="tarjeta acento"><div class="etiqueta">Ingresos de hoy</div><div class="valor">${util.bs(ingresosDia)}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Ingresos del mes</div><div class="valor">${util.bs(ingresosMes)}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Inscripciones con saldo</div><div class="valor">${pendientes.length}</div></div>
    </div>

    <div class="panel">
      <h3>Saldos pendientes</h3>
      ${pendientes.length ? `
        <table>
          <thead><tr><th>N°</th><th>Alumno</th><th>Total</th><th>Pagado</th><th>Saldo</th><th></th></tr></thead>
          <tbody>${pendientes.map(i => `
            <tr>
              <td>${i.numero}</td>
              <td><strong>${i.alumnos?.nombre || '—'}</strong></td>
              <td>${util.bs(i.total)}</td>
              <td>${util.bs(i.pagado)}</td>
              <td><strong>${util.bs(i.saldo)}</strong></td>
              <td><button class="btn btn-rojo" style="padding:7px 14px"
                    onclick="dialogoCobro(${i.id}, ${i.alumno_id}, ${i.saldo}, '${(i.alumnos?.nombre || '').replace(/'/g, '')}')">Cobrar</button></td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<p class="cargando">No hay saldos pendientes. ✅</p>'}
    </div>

    <div class="panel">
      <h3>Historial de pagos</h3>
      <table>
        <thead><tr><th>Fecha</th><th>Alumno</th><th>Concepto</th><th>Método</th><th>Monto</th><th>Cobró</th>${esAdmin ? '<th></th>' : ''}</tr></thead>
        <tbody>${(pagos.data || []).slice(0, 100).map(p => `
          <tr>
            <td>${new Date(p.fecha).toLocaleString('es-BO')}</td>
            <td>${p.alumnos?.nombre || '—'}</td>
            <td>${p.concepto}</td>
            <td>${p.metodo}</td>
            <td><strong>${util.bs(p.monto)}</strong></td>
            <td>${p.usuario_nombre || '—'}</td>
            ${esAdmin ? `<td class="acciones">${p.pase_dia_id
                  ? '<span class="subtexto" title="Se elimina desde Pases del día">🎟️</span>'
                  : `<button title="Eliminar pago" onclick="eliminarPago(${p.id})">🗑️</button>`}</td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function dialogoCobro(inscripcionId, alumnoId, saldo, alumnoNombre) {
  abrirModal(`Cobrar a ${alumnoNombre}`, `
    <p class="subtexto" style="margin-bottom:14px">Saldo pendiente: <strong>${util.bs(saldo)}</strong></p>
    <div class="campo"><label>Monto a cobrar (Bs.)</label>
      <input type="number" name="monto" min="0.5" max="${saldo}" step="0.5" required value="${saldo}"></div>
    <div class="fila">
      <div class="campo"><label>Método</label>
        <select name="metodo"><option>Efectivo</option><option>QR</option><option>Tarjeta</option><option>Transferencia</option></select></div>
      <div class="campo"><label>Concepto</label><input name="concepto" value="Mensualidad"></div>
    </div>
  `, async (form) => {
    const monto = Number(form.monto.value);
    if (monto <= 0 || monto > saldo) throw new Error('El monto debe ser mayor a 0 y no superar el saldo.');
    verificar(await db.from('pagos').insert({
      inscripcion_id: inscripcionId, alumno_id: alumnoId, monto,
      metodo: form.metodo.value, concepto: form.concepto.value.trim() || 'Mensualidad',
      usuario_nombre: perfilActual?.nombre || '',
    }));
    notificar('Pago registrado.');
    abrirModulo('pagos');
  }, 'Registrar pago');
}

async function eliminarPago(id) {
  if (!confirmar('¿Eliminar este pago? (solo administrador)')) return;
  verificar(await db.from('pagos').delete().eq('id', id));
  notificar('Pago eliminado.');
  abrirModulo('pagos');
}
