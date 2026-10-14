// ============================================================
// PRIME FIT · Impresión de recibos en impresora térmica
//
// Cómo funciona: se arma el recibo en una capa oculta y se usa la
// impresión normal del navegador. Para Windows la térmica es una
// impresora más (con su driver), así que no hace falta ningún
// permiso raro ni hablar ESC/POS a mano.
//
// El papel es de 80 mm; la zona que de verdad imprime son unos
// 72 mm, y a eso se ajusta el ancho del recibo.
//
// El logo que se imprime NO es el de la pantalla: aquel es blanco
// y rojo sobre fondo negro, y en térmica saldría como un ladrillo
// negro. img/logo_recibo.png es la versión en negro sobre blanco.
// ============================================================

const RECIBO_LOGO = 'img/logo_recibo.png';

/** Espera a que el logo esté cargado: si no, se imprime sin él. */
function esperarImagenes(caja) {
  const imgs = [...caja.querySelectorAll('img')];
  return Promise.all(imgs.map(img => img.complete
    ? Promise.resolve()
    : new Promise(listo => { img.onload = img.onerror = listo; })));
}

/** Manda a imprimir el HTML dado y limpia después. */
async function imprimirPapel(html) {
  document.getElementById('areaRecibo')?.remove();

  const caja = document.createElement('div');
  caja.id = 'areaRecibo';
  caja.innerHTML = html;
  document.body.appendChild(caja);

  await esperarImagenes(caja);

  const limpiar = () => {
    caja.remove();
    window.removeEventListener('afterprint', limpiar);
  };
  window.addEventListener('afterprint', limpiar);

  window.print();
  // Respaldo: si el navegador no avisa al terminar, se quita igual
  setTimeout(limpiar, 60000);
}

/** Una línea "etiqueta ....... valor" del recibo. */
function lineaRecibo(etiqueta, valor, fuerte = false) {
  return `<div class="r-linea${fuerte ? ' r-fuerte' : ''}">` +
         `<span>${etiqueta}</span><span>${valor}</span></div>`;
}

/** Trae la configuración del gimnasio (nombre, teléfono, dirección). */
async function datosGimnasio() {
  const r = await db.from('config').select('clave, valor');
  const C = {};
  (r.data || []).forEach(c => C[c.clave] = c.valor);
  return C;
}

/** Cabecera común: logo, título y datos del gimnasio. */
function encabezadoRecibo(C, titulo, anulada) {
  return `
    <img class="r-logo" src="${RECIBO_LOGO}" alt="">
    <div class="r-titulo">${titulo}</div>
    ${C.nombre_gimnasio && C.nombre_gimnasio !== 'Prime Fit'
      ? `<div class="r-centro">${C.nombre_gimnasio}</div>` : ''}
    ${C.telefono ? `<div class="r-centro r-chico">Tel. ${C.telefono}</div>` : ''}
    ${C.direccion ? `<div class="r-centro r-chico">${C.direccion}</div>` : ''}
    ${anulada ? '<div class="r-anulada">ANULADA · SIN VALIDEZ</div>' : ''}`;
}

/** Pie común: quién atendió, el agradecimiento y el aire para el cortador. */
function pieRecibo(usuario, gracias, aviso) {
  return `
    <div class="r-raya"></div>
    ${usuario ? `<div class="r-chico">Atendió: ${usuario}</div>` : ''}
    <div class="r-gracias">${aviso ? aviso + '<br>' : ''}${gracias}</div>
    <div class="r-aire"></div>`;
}

// ============================================================
// RECIBO DE UNA INSCRIPCIÓN
// ============================================================

async function imprimirInscripcion(id) {
  const [ins, pagos, confs] = await Promise.all([
    db.from('inscripciones')
      .select('*, alumnos(nombre), inscripcion_detalles(precio_mensual, meses, ' +
              'disciplinas(nombre), horarios(dias, hora_inicio, instructores(nombre)))')
      .eq('id', id).single(),
    db.from('pagos').select('monto, metodo, fecha').eq('inscripcion_id', id),
    datosGimnasio(),
  ]);

  if (ins.error) { notificar(ins.error.message, true); return; }
  const i = ins.data;
  const C = confs;

  const cobrado = (pagos.data || []).reduce((s, p) => s + Number(p.monto), 0);
  const saldo = Math.max(Number(i.total) - cobrado, 0);
  const metodos = [...new Set((pagos.data || []).map(p => p.metodo))].join(', ');

  const clases = (i.inscripcion_detalles || []).map(d => {
    const hor = d.horarios ? `${d.horarios.dias} ${d.horarios.hora_inicio}` : '';
    const prof = d.horarios?.instructores?.nombre || '';
    return `<div class="r-clase">
              <strong>${d.disciplinas?.nombre || '—'}</strong>
              ${hor ? `<br>${hor}${prof ? ' · ' + prof : ''}` : ''}
              ${d.meses > 1 ? `<br>${d.meses} meses` : ''}
            </div>`;
  }).join('');

  await imprimirPapel(`
    ${encabezadoRecibo(C, 'Recibo de inscripción', i.anulada)}
    <div class="r-raya"></div>
    ${lineaRecibo('Emitido', util.fecha(util.hoy()))}

    <div class="r-raya"></div>
    <div class="r-etiqueta">Alumno</div>
    <div class="r-nombre">${i.alumnos?.nombre || '—'}</div>

    ${clases ? `<div class="r-etiqueta">Clases</div>${clases}` : ''}

    <div class="r-etiqueta">Vigencia</div>
    <div class="r-vigencia">
      Del <strong>${util.fecha(i.fecha_inicio)}</strong><br>
      al <strong>${util.fecha(i.fecha_fin)}</strong>
    </div>

    <div class="r-raya"></div>
    ${lineaRecibo('Total', util.bs(i.total))}
    ${Number(i.descuento) > 0 ? lineaRecibo('Descuento', '− ' + util.bs(i.descuento)) : ''}
    ${lineaRecibo('Pagado', util.bs(cobrado), true)}
    ${saldo > 0 ? lineaRecibo('Saldo pendiente', util.bs(saldo), true) : ''}
    ${metodos ? lineaRecibo('Forma de pago', metodos) : ''}

    ${pieRecibo(i.usuario_nombre, '¡Gracias por entrenar con nosotros!',
                saldo > 0 ? 'Queda saldo pendiente.' : '')}
  `);
}

// ============================================================
// RECIBO DE UNA VENTA DE PRODUCTOS
// ============================================================

async function imprimirVenta(id) {
  const [ven, C] = await Promise.all([
    db.from('ventas')
      .select('*, venta_detalles(nombre_producto, descripcion_producto, cantidad, precio_unitario)')
      .eq('id', id).single(),
    datosGimnasio(),
  ]);

  if (ven.error) { notificar(ven.error.message, true); return; }
  const v = ven.data;

  // OJO: en el recibo del cliente NUNCA van el precio de compra ni la
  // ganancia, aunque la venta los tenga guardados.
  const lineas = (v.venta_detalles || []).map(d => `
    <div class="r-item">
      <div class="r-item-nombre">${d.cantidad}× ${d.nombre_producto}</div>
      ${d.descripcion_producto ? `<div class="r-chico">${d.descripcion_producto}</div>` : ''}
      <div class="r-linea r-chico">
        <span>${util.bs(d.precio_unitario)} c/u</span>
        <span>${util.bs(Number(d.precio_unitario) * d.cantidad)}</span>
      </div>
    </div>`).join('');

  const unidades = (v.venta_detalles || []).reduce((s, d) => s + d.cantidad, 0);

  await imprimirPapel(`
    ${encabezadoRecibo(C, 'Recibo de venta', v.anulada)}
    <div class="r-raya"></div>
    ${lineaRecibo('Emitido', new Date(v.fecha).toLocaleString('es-BO',
        { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }))}

    <div class="r-raya"></div>
    <div class="r-etiqueta">Productos</div>
    ${lineas || '<div class="r-chico">Sin detalle</div>'}

    <div class="r-raya"></div>
    ${Number(v.descuento) > 0 ? lineaRecibo('Subtotal', util.bs(v.subtotal)) : ''}
    ${Number(v.descuento) > 0 ? lineaRecibo('Descuento', '− ' + util.bs(v.descuento)) : ''}
    ${lineaRecibo('Total', util.bs(v.total), true)}
    ${lineaRecibo('Forma de pago', v.metodo_pago)}
    <div class="r-chico">${unidades} artículo${unidades === 1 ? '' : 's'}</div>

    ${pieRecibo(v.usuario_nombre, '¡Gracias por tu compra!')}
  `);
}
