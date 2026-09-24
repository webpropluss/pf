// ============================================================
// PRIME FIT · Módulo Dashboard
// ============================================================

async function cargarDashboard(contenido) {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();

  // Configuración del aviso (días de anticipación y texto del mensaje).
  // Se trae AQUÍ para que al tocar el botón no haya ninguna espera:
  // si se espera algo, el teléfono bloquea la apertura de WhatsApp.
  const confs = await db.from('config').select('clave, valor');
  const C = {};
  (confs.data || []).forEach(c => C[c.clave] = c.valor);
  const diasAviso = Math.max(1, parseInt(C.dias_aviso_whatsapp || '3', 10));
  const plantilla = C.mensaje_whatsapp ||
    'Hola {nombre} 👋 Te saludamos de Prime Fit 🥊. Tu mensualidad vence el {fecha}. ¡Renueva a tiempo! 💪';

  // Consultas en paralelo
  const [alumnos, horarios, pagosMes, inscripciones, porVencer] = await Promise.all([
    db.from('alumnos').select('id', { count: 'exact', head: true }).eq('activo', true),
    db.from('horarios').select('id', { count: 'exact', head: true }).eq('activo', true),
    db.from('pagos').select('monto, fecha').gte('fecha', inicioMes),
    db.from('inscripciones').select('id, total, anulada').eq('anulada', false),
    db.rpc('inscripciones_por_vencer', { p_dias: diasAviso }),
  ]);

  const ingresosMes = (pagosMes.data || []).reduce((s, p) => s + Number(p.monto), 0);

  // Pagos pendientes: inscripciones cuyo total supera lo pagado
  let pendientes = 0;
  if (inscripciones.data?.length) {
    const { data: todosPagos } = await db.from('pagos').select('inscripcion_id, monto');
    const pagadoPor = {};
    (todosPagos || []).forEach(p => pagadoPor[p.inscripcion_id] = (pagadoPor[p.inscripcion_id] || 0) + Number(p.monto));
    pendientes = inscripciones.data.filter(i => Number(i.total) > (pagadoPor[i.id] || 0)).length;
  }

  // Ingresos de los últimos 7 días
  const dias = [];
  for (let d = 6; d >= 0; d--) {
    const f = new Date(hoy); f.setDate(hoy.getDate() - d);
    dias.push({ clave: f.toISOString().slice(0, 10), etiqueta: f.toLocaleDateString('es-BO', { weekday: 'short' }), monto: 0 });
  }
  const hace7 = new Date(hoy); hace7.setDate(hoy.getDate() - 6); hace7.setHours(0, 0, 0, 0);
  const { data: pagos7 } = await db.from('pagos').select('monto, fecha').gte('fecha', hace7.toISOString());
  (pagos7 || []).forEach(p => {
    const clave = String(p.fecha).slice(0, 10);
    const dia = dias.find(x => x.clave === clave);
    if (dia) dia.monto += Number(p.monto);
  });
  const max = Math.max(...dias.map(d => d.monto), 1);

  contenido.innerHTML = `
    <header class="cabecera">
      <h2>Dashboard</h2>
      <span class="fecha">${hoy.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
    </header>

    <div class="tarjetas">
      <div class="tarjeta acento">
        <div class="etiqueta">Alumnos activos</div>
        <div class="valor">${alumnos.count ?? 0}</div>
      </div>
      <div class="tarjeta acento">
        <div class="etiqueta">Horarios programados</div>
        <div class="valor">${horarios.count ?? 0}</div>
      </div>
      <div class="tarjeta acento">
        <div class="etiqueta">Ingresos del mes</div>
        <div class="valor">${util.bs(ingresosMes)}</div>
      </div>
      <div class="tarjeta acento">
        <div class="etiqueta">Pagos pendientes</div>
        <div class="valor">${pendientes}</div>
      </div>
    </div>

    <div class="panel">
      <h3>Ingresos · últimos 7 días</h3>
      <div class="grafico">
        ${dias.map(d => `
          <div class="barra">
            <div class="monto">${d.monto ? util.bs(d.monto) : ''}</div>
            <div class="relleno" style="height:${Math.round(d.monto / max * 100)}%"></div>
            <div class="dia">${d.etiqueta}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="panel">
      <h3>📲 Mensualidades por vencer (próximos ${diasAviso} días)</h3>
      ${(porVencer.data?.length)
        ? `<table>
             <thead><tr><th>Alumno</th><th>Teléfono</th><th>Vence</th><th>Aviso</th><th></th></tr></thead>
             <tbody>
               ${porVencer.data.map(v => {
                 const fechaBonita = new Date(v.fecha_fin + 'T00:00:00')
                   .toLocaleDateString('es-BO', { day: 'numeric', month: 'long' });
                 const mensaje = plantilla
                   .replaceAll('{nombre}', v.alumno_nombre)
                   .replaceAll('{fecha}', fechaBonita);
                 // Los datos quedan guardados para registrarlos al confirmar
                 avisosPendientes[v.inscripcion_id] = {
                   alumno_id: v.alumno_id, inscripcion_id: v.inscripcion_id,
                   telefono: v.telefono, mensaje,
                 };
                 const enlace = `https://wa.me/${v.telefono}?text=${encodeURIComponent(mensaje)}`;
                 return `
                 <tr id="filaAviso-${v.inscripcion_id}">
                   <td>${v.alumno_nombre}</td>
                   <td>${v.telefono ? telefonoMostrar(v.telefono) : '<span class="pill pill-rojo">Sin teléfono</span>'}</td>
                   <td>${util.fecha(v.fecha_fin)}</td>
                   <td><span class="pill pill-amarillo">Sin enviar</span></td>
                   <td class="acciones">${v.telefono ? `
                     <a class="btn btn-rojo" href="${enlace}" target="_blank" rel="noopener"
                        onclick="mostrarConfirmacionAviso(${v.inscripcion_id})">📲 Abrir WhatsApp</a>
                     <button class="btn btn-oscuro" id="confirmar-${v.inscripcion_id}"
                             style="display:none" onclick="marcarAvisoEnviado(${v.inscripcion_id})">
                       ✓ Ya lo envié</button>` : ''}</td>
                 </tr>`; }).join('')}
             </tbody>
           </table>
           <p class="subtexto" style="margin-top:10px">
             <strong>Abrir WhatsApp</strong> abre el chat con el mensaje ya escrito — ahí presionas enviar.
             Al volver, toca <strong>✓ Ya lo envié</strong> para que salga de esta lista.
             100% gratis: sale desde el WhatsApp normal del gimnasio.</p>`
        : `<p class="cargando">No hay mensualidades por vencer en los próximos ${diasAviso} días. ✅</p>`}
    </div>`;
}

// ============================================================
// Aviso por WhatsApp (gratis, desde el WhatsApp del gimnasio)
//
// El botón es un ENLACE de verdad, no JavaScript: así el teléfono
// nunca bloquea la apertura de WhatsApp. Y el aviso se marca como
// enviado solo cuando la persona lo confirma, no antes.
// ============================================================

let avisosPendientes = {};   // datos de cada aviso, listos para registrar

/** Al abrir WhatsApp, aparece el botón para confirmar el envío. */
function mostrarConfirmacionAviso(inscripcionId) {
  const btn = document.getElementById('confirmar-' + inscripcionId);
  if (btn) btn.style.display = '';
}

/** Registra el aviso, ya confirmado por la persona. */
async function marcarAvisoEnviado(inscripcionId) {
  const v = avisosPendientes[inscripcionId];
  if (!v) return;

  const r = await db.from('avisos_whatsapp').upsert({
    alumno_id: v.alumno_id, inscripcion_id: v.inscripcion_id,
    telefono: v.telefono, mensaje: v.mensaje, estado: 'enviado',
    detalle_error: 'Enviado a mano por WhatsApp',
  }, { onConflict: 'inscripcion_id' });

  if (r.error) { notificar(r.error.message, true); return; }

  const fila = document.getElementById('filaAviso-' + inscripcionId);
  if (fila) {
    fila.querySelector('.pill').outerHTML = '<span class="pill pill-verde">Enviado</span>';
    fila.querySelector('.acciones').innerHTML = '<span class="subtexto">Listo ✅</span>';
  }
  notificar('Aviso registrado como enviado.');
}
