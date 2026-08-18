// ============================================================
// PRIME FIT · Módulo Dashboard
// ============================================================

async function cargarDashboard(contenido) {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();

  // Días de anticipación configurables (Configuración → Aviso de WhatsApp)
  const confDias = await db.from('config').select('valor').eq('clave', 'dias_aviso_whatsapp').single();
  const diasAviso = Math.max(1, parseInt(confDias.data?.valor || '3', 10));

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
               ${porVencer.data.map(v => `
                 <tr id="filaAviso-${v.inscripcion_id}">
                   <td>${v.alumno_nombre}</td>
                   <td>${v.telefono || '<span class="pill pill-rojo">Sin teléfono</span>'}</td>
                   <td>${util.fecha(v.fecha_fin)}</td>
                   <td><span class="pill pill-amarillo">Pendiente</span></td>
                   <td>${v.telefono ? `<button class="btn btn-rojo" style="padding:7px 14px"
                        onclick='enviarWhatsAppGratis(${JSON.stringify(v)})'>📲 Enviar WhatsApp</button>` : ''}</td>
                 </tr>`).join('')}
             </tbody>
           </table>
           <p class="subtexto" style="margin-top:10px">
             El botón abre WhatsApp con el mensaje ya escrito y personalizado — solo presiona enviar.
             100% gratis: sale desde el WhatsApp normal del gimnasio.</p>`
        : `<p class="cargando">No hay mensualidades por vencer en los próximos ${diasAviso} días. ✅</p>`}
    </div>`;
}

// ============================================================
// Envío GRATUITO por WhatsApp: abre wa.me con el mensaje listo
// y registra el aviso para no repetirlo.
// ============================================================
async function enviarWhatsAppGratis(v) {
  // Plantilla configurable en Configuración ({nombre} y {fecha})
  const { data: conf } = await db.from('config').select('valor').eq('clave', 'mensaje_whatsapp').single();
  const plantilla = conf?.valor ||
    'Hola {nombre} 👋 Te saludamos de Prime Fit 🥊. Tu mensualidad vence el {fecha}. ¡Renueva a tiempo! 💪';

  const fechaBonita = new Date(v.fecha_fin + 'T00:00:00')
    .toLocaleDateString('es-BO', { day: 'numeric', month: 'long' });
  const mensaje = plantilla.replaceAll('{nombre}', v.alumno_nombre).replaceAll('{fecha}', fechaBonita);

  // Abrir WhatsApp (Web o app) con el chat y el texto ya preparados
  window.open(`https://wa.me/${v.telefono}?text=${encodeURIComponent(mensaje)}`, '_blank');

  // Registrar el aviso para que salga de la lista de pendientes
  await db.from('avisos_whatsapp').upsert({
    alumno_id: v.alumno_id, inscripcion_id: v.inscripcion_id,
    telefono: v.telefono, mensaje, estado: 'enviado',
    detalle_error: 'Enviado manualmente con wa.me (opción gratuita)',
  }, { onConflict: 'inscripcion_id' });

  const fila = document.getElementById('filaAviso-' + v.inscripcion_id);
  if (fila) fila.querySelector('.pill').outerHTML = '<span class="pill pill-verde">Enviado</span>';
  notificar('WhatsApp abierto con el mensaje listo. El aviso quedó registrado.');
}
