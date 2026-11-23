// ============================================================
// PRIME FIT · Reporte de ventas (solo administrador)
//
// Por cada producto, en el rango de fechas elegido:
//   Invertido           → mercadería que había al empezar + lo que se compró
//   Inversión vendida   → lo que costó lo que se vendió
//   Vendido             → lo que pagaron los clientes
//   Ganancia            → vendido − inversión vendida
//   Queda invertido     → mercadería que sigue en el estante al cerrar el rango
//
// El stock a una fecha se reconstruye con la bitácora (movimientos_stock):
// stock de hoy menos todo lo que entró y salió después de esa fecha.
// La mercadería se valúa al precio de compra actual de cada producto.
// ============================================================

let rvDatos = null;   // último reporte, para exportarlo

async function cargarReporteVentas(contenido) {
  const hoy = util.hoy();
  contenido.innerHTML = `
    <header class="cabecera"><h2>Reporte de ventas</h2></header>
    <div class="toolbar">
      <label class="subtexto">Desde</label><input type="date" id="rvDesde" value="${hoy.slice(0, 8)}01">
      <label class="subtexto">Hasta</label><input type="date" id="rvHasta" value="${hoy}">
      <button class="btn btn-rojo" onclick="generarReporteVentas()">Generar</button>
      <button class="btn btn-oscuro" onclick="exportarReporteVentas()">📥 Exportar a Excel</button>
    </div>
    <div id="rvResultado"><p class="cargando">Generando…</p></div>`;
  generarReporteVentas();
}

async function generarReporteVentas() {
  const desde = document.getElementById('rvDesde').value;
  const hasta = document.getElementById('rvHasta').value;
  const cont = document.getElementById('rvResultado');
  if (!desde || !hasta) { notificar('Elige las dos fechas.', true); return; }
  if (desde > hasta) { notificar('La fecha "desde" es posterior a la "hasta".', true); return; }
  cont.innerHTML = '<p class="cargando">Generando…</p>';

  const desdeTS = util.desdeISO(desde), hastaTS = util.hastaISO(hasta);

  // La bitácora va desde el inicio del rango hasta HOY: lo que pasó
  // después del cierre hace falta para saber cuánto stock había ese día.
  const pedirMovs = (cols) => traerTodas(() => db.from('movimientos_stock').select(cols)
    .gte('fecha', desdeTS).order('fecha').order('id'));

  const [productos, movsR, ventas, promos] = await Promise.all([
    db.from('productos').select('id, codigo, nombre, descripcion, categoria, precio_compra, stock, activo'),
    pedirMovs('producto_id, fecha, tipo, cantidad, costo_unitario, motivo'),
    traerTodas(() => db.from('ventas')
      .select('id, numero, fecha, subtotal, descuento, total, costo, ganancia, metodo_pago, usuario_nombre, ' +
              'venta_detalles(producto_id, nombre_producto, descripcion_producto, cantidad, precio_unitario, precio_compra)')
      .eq('anulada', false).gte('fecha', desdeTS).lte('fecha', hastaTS).order('fecha').order('id')),
    db.from('promociones').select('costo, promocion_detalles(producto_id, cantidad)')
      .eq('anulada', false).gte('fecha', desdeTS).lte('fecha', hastaTS),
  ]);

  // Sin el paso 21 la columna del costo no existe: se reintenta sin ella
  let movs = movsR, faltaPaso21 = false;
  if (movsR.error) {
    faltaPaso21 = true;
    movs = await pedirMovs('producto_id, fecha, tipo, cantidad, motivo');
  }
  for (const r of [productos, movs, ventas, promos]) {
    if (r.error) { cont.innerHTML = `<p class="cargando">${r.error.message}</p>`; return; }
  }

  const listaVentas = ventas.data || [];
  const listaPromos = promos.data || [];
  const prodPorId = new Map((productos.data || []).map(p => [String(p.id), p]));
  const hastaMs = Date.parse(hastaTS);

  // ---------- Una fila por producto ----------
  const filas = new Map();
  const fila = (clave, nombre, descripcion, prod) => {
    if (!filas.has(clave)) filas.set(clave, {
      nombre, descripcion: descripcion || '', codigo: prod?.codigo || '', categoria: prod?.categoria || '',
      precioCompra: Number(prod?.precio_compra || 0), stockHoy: prod ? Number(prod.stock) : 0,
      existe: !!prod,
      compraU: 0, compraBs: 0, ventaU: 0, ventaBs: 0, costoBs: 0,
      regaloU: 0, movDespues: 0, movDesde: 0,
    });
    return filas.get(clave);
  };
  const filaDe = (id, nombre, desc) => {
    const p = id != null ? prodPorId.get(String(id)) : null;
    return p ? fila('p' + p.id, p.nombre, p.descripcion, p)
             : fila('n' + nombre + '|' + (desc || ''), nombre, desc, null);   // producto ya borrado
  };
  prodPorId.forEach(p => fila('p' + p.id, p.nombre, p.descripcion, p));

  const compras = [];
  (movs.data || []).forEach(m => {
    const p = prodPorId.get(String(m.producto_id));
    if (!p) return;
    const f = fila('p' + p.id, p.nombre, p.descripcion, p);
    const cant = Number(m.cantidad);
    f.movDesde += cant;
    if (Date.parse(m.fecha) > hastaMs) { f.movDespues += cant; return; }
    if (m.tipo === 'compra' && cant > 0) {
      const costo = Number(m.costo_unitario ?? p.precio_compra);
      f.compraU += cant;
      f.compraBs += cant * costo;
      compras.push({ fecha: m.fecha, producto: p.nombre, descripcion: p.descripcion || '',
                     cantidad: cant, costo, total: cant * costo, motivo: m.motivo || '' });
    }
  });

  listaVentas.forEach(v => (v.venta_detalles || []).forEach(d => {
    const f = filaDe(d.producto_id, d.nombre_producto, d.descripcion_producto);
    const cant = Number(d.cantidad);
    f.ventaU  += cant;
    f.ventaBs += cant * Number(d.precio_unitario);
    f.costoBs += cant * Number(d.precio_compra);
  }));

  listaPromos.forEach(r => (r.promocion_detalles || []).forEach(d => {
    const p = prodPorId.get(String(d.producto_id));
    if (p) fila('p' + p.id, p.nombre, p.descripcion, p).regaloU += Number(d.cantidad);
  }));

  filas.forEach(f => {
    f.stockIni  = f.stockHoy - f.movDesde;
    f.stockFin  = f.stockHoy - f.movDespues;
    f.valorIni  = f.stockIni * f.precioCompra;
    f.valorFin  = f.stockFin * f.precioCompra;
    f.invertido = f.valorIni + f.compraBs;     // todo lo que se tuvo para vender
    f.ganancia  = f.ventaBs - f.costoBs;
  });

  const vista = [...filas.values()]
    .filter(f => f.invertido || f.ventaU || f.stockFin)
    .sort((a, b) => b.ganancia - a.ganancia || b.invertido - a.invertido || a.nombre.localeCompare(b.nombre));

  const suma = (l, fn) => l.reduce((s, x) => s + fn(x), 0);
  const T = {
    valorIni:     suma(vista, f => f.valorIni),
    comprado:     suma(vista, f => f.compraBs),
    invertido:    suma(vista, f => f.invertido),
    costoVendido: suma(listaVentas, v => Number(v.costo)),
    vendido:      suma(listaVentas, v => Number(v.total)),
    descuentos:   suma(listaVentas, v => Number(v.descuento)),
    ganancia:     suma(listaVentas, v => Number(v.ganancia)),
    nVentas:      listaVentas.length,
    unidades:     suma(vista, f => f.ventaU),
    regalado:     suma(listaPromos, r => Number(r.costo)),
    valorFin:     suma(vista, f => f.valorFin),
  };
  // Lo que no explican las ventas ni los regalos: mermas, conteos
  // corregidos, devoluciones o cambios del precio de compra.
  T.ajustes = T.valorFin - (T.invertido - T.costoVendido - T.regalado);

  rvDatos = { desde, hasta, filas: vista, compras, ventas: listaVentas, T };
  cont.innerHTML = vistaReporteVentas(T, vista, compras, desde, hasta, faltaPaso21);
}

function vistaReporteVentas(T, filas, compras, desde, hasta, faltaPaso21) {
  const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;
  const pl = (n, s, p) => `${n} ${n === 1 ? s : (p || s + 's')}`;
  const color = (n) => n < 0 ? '#ff8a8f' : 'var(--verde)';
  const u = (n) => `<div class="subtexto">${n} u</div>`;
  const cierre = hasta === util.hoy() ? 'hoy' : `el ${util.fecha(hasta)}`;

  return `
    ${faltaPaso21 ? `
      <div class="panel"><p class="subtexto" style="margin:0">⚠️ Falta ejecutar
        <strong>supabase/21_reporte_ventas.sql</strong>: mientras tanto las compras se calculan
        con el precio de compra de hoy.</p></div>` : ''}

    <div class="tarjetas">
      <div class="tarjeta acento"><div class="etiqueta">Invertido en mercadería</div>
        <div class="valor">${util.bs(T.invertido)}</div>
        <div class="subtexto">${util.bs(T.valorIni)} en stock al ${util.fecha(desde)}
          + ${util.bs(T.comprado)} comprado</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Inversión de lo vendido</div>
        <div class="valor">${util.bs(T.costoVendido)}</div>
        <div class="subtexto">lo que costó lo vendido · ${pl(T.unidades, 'unidad', 'unidades')}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Vendido</div>
        <div class="valor">${util.bs(T.vendido)}</div>
        <div class="subtexto">${pl(T.nVentas, 'venta')}${T.descuentos > 0 ? ` · ${util.bs(T.descuentos)} de descuento` : ''}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Ganancia</div>
        <div class="valor" style="color:${color(T.ganancia)}">${util.bs(T.ganancia)}</div>
        <div class="subtexto">${pct(T.ganancia, T.vendido)}% de lo vendido</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Queda invertido</div>
        <div class="valor">${util.bs(T.valorFin)}</div>
        <div class="subtexto">mercadería en stock ${cierre}</div></div>
    </div>

    <div class="panel">
      <h3>Por producto (${filas.length})</h3>
      <table>
        <thead><tr><th>Producto</th><th>Invertido</th><th>Inversión vendida</th>
                   <th>Vendido</th><th>Ganancia</th><th>Queda invertido</th></tr></thead>
        <tbody>${filas.map(f => `
          <tr>
            <td><strong>${f.nombre}</strong>${f.descripcion ? ` <span class="subtexto">(${f.descripcion})</span>` : ''}${
              !f.existe ? ' <span class="pill pill-rojo">Eliminado</span>' : ''}
              <div class="subtexto">${[f.codigo, f.categoria].filter(Boolean).join(' · ')}</div></td>
            <td>${f.existe ? `${util.bs(f.invertido)}${u(f.stockIni + f.compraU)}` : '—'}</td>
            <td>${f.ventaU ? `${util.bs(f.costoBs)}${u(f.ventaU)}` : '—'}</td>
            <td>${f.ventaU ? util.bs(f.ventaBs) : '—'}</td>
            <td>${f.ventaU ? `<strong style="color:${color(f.ganancia)}">${util.bs(f.ganancia)}</strong>` : '—'}</td>
            <td>${f.existe ? `${util.bs(f.valorFin)}${u(f.stockFin)}` : '—'}${
              f.regaloU ? `<div class="subtexto">${f.regaloU} regalado${f.regaloU === 1 ? '' : 's'}</div>` : ''}</td>
          </tr>`).join('') ||
          '<tr><td colspan="6" class="cargando">Sin mercadería ni ventas en el rango.</td></tr>'}
          ${filas.length ? `
          ${T.descuentos > 0 ? `
          <tr><td><span class="subtexto">Descuentos dados en caja</span></td><td></td><td></td>
              <td>− ${util.bs(T.descuentos)}</td><td>− ${util.bs(T.descuentos)}</td><td></td></tr>` : ''}
          <tr class="fila-total"><td><strong>TOTAL</strong></td>
              <td><strong>${util.bs(T.invertido)}</strong></td>
              <td><strong>${util.bs(T.costoVendido)}</strong></td>
              <td><strong>${util.bs(T.vendido)}</strong></td>
              <td><strong style="color:${color(T.ganancia)}">${util.bs(T.ganancia)}</strong></td>
              <td><strong>${util.bs(T.valorFin)}</strong></td></tr>` : ''}
        </tbody>
      </table>
      <p class="subtexto" style="margin-top:10px">
        <strong>Invertido</strong> = mercadería que había al ${util.fecha(desde)} + lo que se compró hasta
        ${util.fecha(hasta)}. Todo se valúa al precio de compra.
        ${T.regalado > 0 ? ` Se regalaron ${util.bs(T.regalado)} en promociones.` : ''}
        ${Math.abs(T.ajustes) >= 0.01 ? ` Ajustes de stock (mermas, conteos, cambios de precio):
          ${T.ajustes < 0 ? '−' : '+'}${util.bs(Math.abs(T.ajustes))}.` : ''}
      </p>
    </div>

    <div class="panel">
      <h3>Compras de mercadería del rango (${compras.length})</h3>
      <table>
        <thead><tr><th>Fecha</th><th>Producto</th><th>Cantidad</th><th>Costo unitario</th><th>Total</th><th>Motivo</th></tr></thead>
        <tbody>${compras.map(c => `
          <tr><td>${new Date(c.fecha).toLocaleDateString('es-BO')}</td>
              <td><strong>${c.producto}</strong>${c.descripcion ? ` <span class="subtexto">(${c.descripcion})</span>` : ''}</td>
              <td>${c.cantidad}</td><td>${util.bs(c.costo)}</td>
              <td><strong>${util.bs(c.total)}</strong></td>
              <td class="subtexto">${c.motivo || '—'}</td></tr>`).join('') ||
          '<tr><td colspan="6" class="cargando">No entró mercadería en el rango.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

/** Excel: resumen, por producto, compras y ventas. */
function exportarReporteVentas() {
  if (!rvDatos) { notificar('Primero genera el reporte.', true); return; }
  const { desde, hasta, filas, compras, ventas, T } = rvDatos;
  const r2 = (n) => Math.round(Number(n) * 100) / 100;
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { Concepto: `Mercadería en stock al ${desde}`, 'Monto (Bs.)': r2(T.valorIni) },
    { Concepto: 'Comprado en el rango',            'Monto (Bs.)': r2(T.comprado) },
    { Concepto: 'Invertido en mercadería',         'Monto (Bs.)': r2(T.invertido) },
    { Concepto: 'Inversión de lo vendido',         'Monto (Bs.)': r2(T.costoVendido) },
    { Concepto: 'Vendido',                         'Monto (Bs.)': r2(T.vendido) },
    { Concepto: 'Descuentos',                      'Monto (Bs.)': r2(T.descuentos) },
    { Concepto: 'Ganancia',                        'Monto (Bs.)': r2(T.ganancia) },
    { Concepto: 'Regalado en promociones',         'Monto (Bs.)': r2(T.regalado) },
    { Concepto: 'Ajustes de stock',                'Monto (Bs.)': r2(T.ajustes) },
    { Concepto: `Queda invertido al ${hasta}`,     'Monto (Bs.)': r2(T.valorFin) },
  ]), 'Resumen');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas.map(f => ({
    Código: f.codigo, Producto: f.nombre, Descripción: f.descripcion, Categoría: f.categoria,
    'Invertido (u)': f.existe ? f.stockIni + f.compraU : '', 'Invertido (Bs.)': f.existe ? r2(f.invertido) : '',
    'Vendido (u)': f.ventaU, 'Inversión vendida (Bs.)': r2(f.costoBs),
    'Vendido (Bs.)': r2(f.ventaBs), 'Ganancia (Bs.)': r2(f.ganancia),
    'Queda (u)': f.existe ? f.stockFin : '', 'Queda invertido (Bs.)': f.existe ? r2(f.valorFin) : '',
  }))), 'Por producto');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compras.map(c => ({
    Fecha: new Date(c.fecha).toLocaleDateString('es-BO'), Producto: c.producto, Descripción: c.descripcion,
    Cantidad: c.cantidad, 'Costo unitario (Bs.)': r2(c.costo), 'Total (Bs.)': r2(c.total), Motivo: c.motivo,
  }))), 'Compras');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventas.map(v => ({
    'N°': v.numero, Fecha: new Date(v.fecha).toLocaleString('es-BO'),
    Productos: (v.venta_detalles || []).map(d => `${d.cantidad}× ${d.nombre_producto}`).join(', '),
    'Total (Bs.)': r2(v.total), 'Descuento (Bs.)': r2(v.descuento),
    'Costo (Bs.)': r2(v.costo), 'Ganancia (Bs.)': r2(v.ganancia),
    Método: v.metodo_pago, Vendió: v.usuario_nombre || '',
  }))), 'Ventas');

  XLSX.writeFile(wb, `PrimeFit_ReporteVentas_${desde}_a_${hasta}.xlsx`);
}
