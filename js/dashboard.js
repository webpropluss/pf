// ============================================================
// PRIME FIT · Módulo Dashboard
//
// Todo lo que se muestra depende del PERÍODO elegido arriba.
// Las inscripciones se cuentan por su FECHA DE INICIO (cuándo
// empezó la mensualidad), no por el día en que se cargaron al
// sistema. El dinero se cuenta por la fecha del cobro, que se
// elige al inscribir y por defecto es la fecha de inicio.
// ============================================================

// Período que se está viendo. Al abrir: hoy.
let dashPeriodo = { modo: 'hoy', desde: null, hasta: null };

/** Calcula desde/hasta (en texto AAAA-MM-DD) según el modo. */
function rangoDelModo(modo, desde, hasta) {
  const hoy = util.hoy();
  const menos = (n) => {
    const f = new Date(hoy + 'T12:00:00'); f.setDate(f.getDate() - n);
    return f.toISOString().slice(0, 10);
  };
  switch (modo) {
    case 'hoy':    return { desde: hoy, hasta: hoy };
    case 'semana': return { desde: menos(6), hasta: hoy };
    case 'mes':    return { desde: hoy.slice(0, 8) + '01', hasta: hoy };
    case 'rango':  return { desde: desde || hoy, hasta: hasta || hoy };
    default:       return { desde: hoy, hasta: hoy };
  }
}

/** Cambia el período y vuelve a dibujar. */
function dashFiltro(modo) {
  dashPeriodo = { modo, ...rangoDelModo(modo, dashPeriodo.desde, dashPeriodo.hasta) };
  if (modo === 'rango') { dibujarSelectorRango(); return; }
  abrirModulo('dashboard');
}

/** Muestra los dos campos de fecha para elegir a mano. */
function dibujarSelectorRango() {
  const caja = document.getElementById('rangoPersonal');
  if (!caja) return;
  caja.hidden = false;
  document.querySelectorAll('.chip-periodo').forEach(b =>
    b.classList.toggle('activo', b.dataset.modo === 'rango'));
  document.getElementById('dashDesde').value = dashPeriodo.desde;
  document.getElementById('dashHasta').value = dashPeriodo.hasta;
}

/** Aplica las fechas escritas a mano. */
function dashAplicarRango() {
  const desde = document.getElementById('dashDesde').value;
  const hasta = document.getElementById('dashHasta').value;
  if (!desde || !hasta) { notificar('Elige las dos fechas.', true); return; }
  if (desde > hasta) { notificar('La fecha "desde" es posterior a la "hasta".', true); return; }
  dashPeriodo = { modo: 'rango', desde, hasta };
  abrirModulo('dashboard');
}

/** Texto legible del período, para el encabezado. */
function textoPeriodo(p) {
  if (p.desde === p.hasta) {
    return p.desde === util.hoy() ? 'Hoy' : util.fecha(p.desde);
  }
  return `${util.fecha(p.desde)} → ${util.fecha(p.hasta)}`;
}

/** Cuántos días abarca el período (incluyendo los dos extremos). */
function diasDelPeriodo(p) {
  const a = new Date(p.desde + 'T12:00:00'), b = new Date(p.hasta + 'T12:00:00');
  return Math.round((b - a) / 86400000) + 1;
}

// ============================================================

async function cargarDashboard(contenido) {
  // Si es la primera vez, el período arranca en "hoy"
  if (!dashPeriodo.desde) dashPeriodo = { modo: 'hoy', ...rangoDelModo('hoy') };
  const P = dashPeriodo;
  const desdeTS = P.desde + 'T00:00:00';
  const hastaTS = P.hasta + 'T23:59:59';

  // Configuración del aviso (días de anticipación y texto del mensaje).
  // Se trae AQUÍ para que al tocar el botón no haya ninguna espera:
  // si se espera algo, el teléfono bloquea la apertura de WhatsApp.
  const confs = await db.from('config').select('clave, valor');
  const C = {};
  (confs.data || []).forEach(c => C[c.clave] = c.valor);
  const diasAviso = Math.max(1, parseInt(C.dias_aviso_whatsapp || '3', 10));
  const plantilla = C.mensaje_whatsapp ||
    'Hola {nombre} 👋 Te saludamos de Prime Fit 🥊. Tu mensualidad vence el {fecha}. ¡Renueva a tiempo! 💪';

  // ---- Gráfico: se agrupa según lo largo que sea el período, para que
  //      en el teléfono nunca queden 31 barritas ilegibles ----
  const nDias = diasDelPeriodo(P);
  const grano = nDias <= 14 ? 'dia' : nDias <= 92 ? 'semana' : 'mes';
  let graDesde = P.desde;
  if (grano === 'dia' && nDias < 7) {   // "Hoy" solo sería una barra
    const f = new Date(P.hasta + 'T12:00:00'); f.setDate(f.getDate() - 6);
    graDesde = f.toISOString().slice(0, 10);
  }

  // Consultas en paralelo
  const [alumnos, pagos, nuevasIns, insAbiertas, porVencer, pases, ventas, promos, pagosGrafico] =
    await Promise.all([
      db.from('alumnos').select('id', { count: 'exact', head: true }).eq('activo', true),
      db.from('pagos').select('monto, fecha').gte('fecha', desdeTS).lte('fecha', hastaTS),
      // ← las inscripciones se cuentan por CUÁNDO EMPIEZA la mensualidad
      db.from('inscripciones').select('id, total, fecha_inicio')
        .eq('anulada', false).gte('fecha_inicio', P.desde).lte('fecha_inicio', P.hasta),
      db.from('inscripciones').select('id, total').eq('anulada', false),
      db.rpc('inscripciones_por_vencer', { p_dias: diasAviso }),
      db.from('pases_dia').select('monto').gte('fecha', P.desde).lte('fecha', P.hasta),
      db.from('ventas').select('total, venta_detalles(cantidad)')
        .eq('anulada', false).gte('fecha', desdeTS).lte('fecha', hastaTS),
      // Regalos: salen del stock pero NO son ingreso, por eso van aparte
      db.from('promociones').select('costo, valor_venta, promocion_detalles(cantidad)')
        .eq('anulada', false).gte('fecha', desdeTS).lte('fecha', hastaTS),
      db.from('pagos').select('monto, fecha')
        .gte('fecha', graDesde + 'T00:00:00').lte('fecha', hastaTS),
    ]);

  const ingresos = (pagos.data || []).reduce((s, p) => s + Number(p.monto), 0);

  // Inscripciones que EMPIEZAN en el período
  const nInscripciones = (nuevasIns.data || []).length;
  const bsInscripciones = (nuevasIns.data || []).reduce((s, i) => s + Number(i.total), 0);

  // Pases del día
  const nPases = (pases.data || []).length;
  const bsPases = (pases.data || []).reduce((s, p) => s + Number(p.monto), 0);

  // Venta de productos
  const nVentas = (ventas.data || []).length;
  const bsVentas = (ventas.data || []).reduce((s, v) => s + Number(v.total), 0);
  const artVendidos = (ventas.data || [])
    .reduce((s, v) => s + (v.venta_detalles || []).reduce((t, d) => t + d.cantidad, 0), 0);

  // Productos regalados (gasto promocional): no son ingreso, son gasto
  const gastoPromo  = (promos.data || []).reduce((s, p) => s + Number(p.costo), 0);
  const valorPromo  = (promos.data || []).reduce((s, p) => s + Number(p.valor_venta), 0);
  const artRegalados = (promos.data || [])
    .reduce((s, p) => s + (p.promocion_detalles || []).reduce((t, d) => t + d.cantidad, 0), 0);

  // Pagos pendientes: se miran TODAS las inscripciones vigentes, no solo
  // las del período: una deuda vieja sigue siendo una deuda hoy.
  let pendientes = 0, bsPendiente = 0;
  if (insAbiertas.data?.length) {
    const { data: todosPagos } = await db.from('pagos').select('inscripcion_id, monto');
    const pagadoPor = {};
    (todosPagos || []).forEach(p =>
      pagadoPor[p.inscripcion_id] = (pagadoPor[p.inscripcion_id] || 0) + Number(p.monto));
    insAbiertas.data.forEach(i => {
      const falta = Number(i.total) - (pagadoPor[i.id] || 0);
      if (falta > 0) { pendientes++; bsPendiente += falta; }
    });
  }

  // ---- Barras del gráfico ----
  // A qué barra pertenece una fecha, según el grano elegido
  const cubeta = (iso) => {
    if (grano === 'mes') return iso.slice(0, 7);
    if (grano === 'dia') return iso.slice(0, 10);
    const f = new Date(iso.slice(0, 10) + 'T12:00:00');       // semana: va al lunes
    f.setDate(f.getDate() - ((f.getDay() + 6) % 7));
    return f.toISOString().slice(0, 10);
  };

  const cubos = [];
  const fin = new Date(P.hasta + 'T12:00:00');
  if (grano === 'mes') {
    const ini = new Date(graDesde + 'T12:00:00'); ini.setDate(1);
    for (let f = new Date(ini); f <= fin; f.setMonth(f.getMonth() + 1)) {
      cubos.push({ clave: f.toISOString().slice(0, 7), monto: 0,
        etiqueta: f.toLocaleDateString('es-BO', { month: 'short' }) });
    }
  } else {
    const paso = grano === 'semana' ? 7 : 1;
    const ini = new Date(cubeta(graDesde) + 'T12:00:00');
    for (let f = new Date(ini); f <= fin; f.setDate(f.getDate() + paso)) {
      cubos.push({ clave: f.toISOString().slice(0, 10), monto: 0,
        etiqueta: f.toLocaleDateString('es-BO', { day: 'numeric', month: 'numeric' }) });
    }
  }

  (pagosGrafico.data || []).forEach(p => {
    const c = cubos.find(x => x.clave === cubeta(String(p.fecha)));
    if (c) c.monto += Number(p.monto);
  });
  const max = Math.max(...cubos.map(c => c.monto), 1);
  const compacto = cubos.length > 10;

  const chip = (modo, texto) =>
    `<button type="button" class="chip-periodo ${P.modo === modo ? 'activo' : ''}"
             data-modo="${modo}" onclick="dashFiltro('${modo}')">${texto}</button>`;

  contenido.innerHTML = `
    <header class="cabecera">
      <h2>Dashboard</h2>
      <span class="fecha">${textoPeriodo(P)}</span>
    </header>

    <div class="filtro-periodo">
      ${chip('hoy', 'Hoy')}
      ${chip('semana', '7 días')}
      ${chip('mes', 'Este mes')}
      ${chip('rango', '📅 Elegir fechas')}
    </div>
    <div id="rangoPersonal" class="rango-personal" ${P.modo === 'rango' ? '' : 'hidden'}>
      <div class="campo"><label>Desde</label>
        <input type="date" id="dashDesde" value="${P.desde}"></div>
      <div class="campo"><label>Hasta</label>
        <input type="date" id="dashHasta" value="${P.hasta}"></div>
      <button type="button" class="btn btn-rojo" onclick="dashAplicarRango()">Ver</button>
    </div>

    <div class="tarjetas">
      <div class="tarjeta acento">
        <div class="etiqueta">Ingresos del período</div>
        <div class="valor">${util.bs(ingresos)}</div>
        <div class="subtexto">${(pagos.data || []).length} cobro${(pagos.data || []).length === 1 ? '' : 's'}</div>
      </div>
      <div class="tarjeta acento">
        <div class="etiqueta">Mensualidades que empiezan</div>
        <div class="valor">${nInscripciones}</div>
        <div class="subtexto">${util.bs(bsInscripciones)} en total</div>
      </div>
      <div class="tarjeta acento">
        <div class="etiqueta">Pases del día</div>
        <div class="valor">${nPases}</div>
        <div class="subtexto">${util.bs(bsPases)}</div>
      </div>
      <div class="tarjeta acento">
        <div class="etiqueta">Productos vendidos</div>
        <div class="valor">${artVendidos}</div>
        <div class="subtexto">${nVentas} venta${nVentas === 1 ? '' : 's'} · ${util.bs(bsVentas)}</div>
      </div>
      <div class="tarjeta acento">
        <div class="etiqueta">Gasto promocional</div>
        <div class="valor">${util.bs(gastoPromo)}</div>
        <div class="subtexto">${artRegalados} regalado${artRegalados === 1 ? '' : 's'}${
          valorPromo > 0 ? ` · ${util.bs(valorPromo)} de valor` : ''}</div>
      </div>
      <div class="tarjeta acento">
        <div class="etiqueta">Alumnos activos</div>
        <div class="valor">${alumnos.count ?? 0}</div>
        <div class="subtexto">en total, no del período</div>
      </div>
      <div class="tarjeta acento">
        <div class="etiqueta">Pagos pendientes</div>
        <div class="valor">${pendientes}</div>
        <div class="subtexto">${util.bs(bsPendiente)} por cobrar</div>
      </div>
    </div>

    <div class="panel">
      <h3>Ingresos · ${grano === 'mes' ? 'mes a mes' : grano === 'semana' ? 'semana a semana' : 'día por día'}</h3>
      ${graDesde !== P.desde
        ? `<p class="subtexto" style="margin:-6px 0 10px">Se muestran los 7 días
             hasta el ${util.fecha(P.hasta)}, para que se pueda comparar.</p>`
        : grano === 'semana'
        ? `<p class="subtexto" style="margin:-6px 0 10px">Cada barra es una semana;
             abajo va el lunes con que empieza.</p>` : ''}
      <div class="grafico ${compacto ? 'compacto' : ''}">
        ${cubos.map(c => `
          <div class="barra">
            <div class="monto">${c.monto ? util.bs(c.monto) : ''}</div>
            <div class="relleno" style="height:${Math.round(c.monto / max * 100)}%"></div>
            <div class="dia">${c.etiqueta}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="panel">
      <h3>📲 Mensualidades por vencer (próximos ${diasAviso} días)</h3>
      <p class="subtexto" style="margin:-6px 0 10px">Esto mira hacia adelante desde hoy;
        no depende del período elegido arriba.</p>
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
