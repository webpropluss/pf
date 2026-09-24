// ============================================================
// PRIME FIT · Módulo Ventas (caja)
// Venta rápida: se busca el producto, se pone la cantidad y se vende.
// No hace falta registrar al cliente.
// ============================================================

let ventaLineas = [];      // productos de la venta que se está armando
let ventaCatalogo = [];    // productos disponibles, para el buscador

async function cargarVentas(contenido) {
  const hoy = util.hoy();
  const verGanancia = puedeAccion('verGanancias');

  const ventas = verificar(await db.from('ventas')
    .select('*, venta_detalles(nombre_producto, cantidad, precio_unitario)')
    .order('id', { ascending: false }).limit(150));

  const deHoy = ventas.filter(v => !v.anulada && String(v.fecha).slice(0, 10) === hoy);
  const cobradoHoy  = deHoy.reduce((s, v) => s + Number(v.total), 0);
  const gananciaHoy = deHoy.reduce((s, v) => s + Number(v.ganancia), 0);
  const mes = hoy.slice(0, 7);
  const cobradoMes = ventas.filter(v => !v.anulada && String(v.fecha).slice(0, 7) === mes)
    .reduce((s, v) => s + Number(v.total), 0);

  contenido.innerHTML = `
    <header class="cabecera"><h2>Ventas</h2></header>

    <div class="toolbar">
      <button class="btn btn-rojo" onclick="nuevaVenta()">🛒 Nueva venta</button>
    </div>

    <div class="tarjetas">
      <div class="tarjeta acento"><div class="etiqueta">Ventas de hoy</div>
        <div class="valor">${deHoy.length}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Cobrado hoy</div>
        <div class="valor">${util.bs(cobradoHoy)}</div></div>
      ${verGanancia ? `
      <div class="tarjeta acento"><div class="etiqueta">Ganancia de hoy</div>
        <div class="valor">${util.bs(gananciaHoy)}</div></div>` : ''}
      <div class="tarjeta acento"><div class="etiqueta">Cobrado en el mes</div>
        <div class="valor">${util.bs(cobradoMes)}</div></div>
    </div>

    <div class="panel">
      <h3>Últimas ventas</h3>
      ${ventas.length ? `
        <table>
          <thead><tr><th>N°</th><th>Fecha</th><th>Productos</th><th>Total</th>
                     ${verGanancia ? '<th>Ganancia</th>' : ''}<th>Pago</th><th>Vendió</th><th></th></tr></thead>
          <tbody>
            ${ventas.map(v => `
              <tr style="${v.anulada ? 'opacity:.5' : ''}">
                <td>${v.numero}</td>
                <td>${new Date(v.fecha).toLocaleString('es-BO', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</td>
                <td>${(v.venta_detalles || []).map(d => `${d.cantidad}× ${d.nombre_producto}`).join(', ') || '—'}</td>
                <td><strong>${util.bs(v.total)}</strong>${v.anulada ? ' <span class="pill pill-rojo">Anulada</span>' : ''}</td>
                ${verGanancia ? `<td>${util.bs(v.ganancia)}</td>` : ''}
                <td>${v.metodo_pago}</td>
                <td class="subtexto">${v.usuario_nombre || '—'}</td>
                <td class="acciones">
                  ${!v.anulada && puedeAccion('anular')
                    ? `<button title="Anular: devuelve el stock y quita el cobro" onclick="anularVenta(${v.id}, ${v.numero})">🚫</button>` : ''}
                  ${puedeAccion('eliminar')
                    ? `<button title="Eliminar definitivamente" onclick="eliminarVenta(${v.id}, ${v.numero})">🗑️</button>` : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`
        : '<p class="cargando">Todavía no se registró ninguna venta.</p>'}
    </div>`;
}

// ---------------------- NUEVA VENTA ----------------------

async function nuevaVenta() {
  ventaCatalogo = verificar(await db.from('productos')
    .select('id, nombre, categoria, precio_venta, stock')
    .eq('activo', true).order('nombre'));
  ventaLineas = [];

  abrirModal('Nueva venta', `
    <div class="campo"><label>Buscar producto</label>
      <input type="search" id="buscarVenta" autocomplete="off"
             placeholder="Escribe: agua, proteína, guantes…"
             oninput="buscarProductoVenta()">
    </div>
    <div id="resultadosVenta" class="resultados-venta"></div>

    <div id="lineasVenta"></div>

    <div class="fila">
      <div class="campo"><label>Descuento (Bs.)</label>
        <input type="number" name="descuento" min="0" step="0.5" value="0" oninput="pintarLineasVenta()"></div>
      <div class="campo"><label>Método de pago</label>
        <select name="metodo_pago">
          <option>Efectivo</option><option>QR</option><option>Tarjeta</option><option>Transferencia</option>
        </select></div>
    </div>

    <div class="total-grande" id="totalVenta">Bs. 0.00 <small>total</small></div>
  `, async (form) => {
    if (!ventaLineas.length) throw new Error('Agrega al menos un producto a la venta.');

    const id = verificar(await db.rpc('crear_venta', {
      p_detalles: ventaLineas.map(l => ({ producto_id: l.id, cantidad: l.cantidad })),
      p_descuento: Number(form.descuento.value || 0),
      p_metodo_pago: form.metodo_pago.value,
      p_usuario_nombre: perfilActual?.nombre || '',
    }));

    const total = ventaLineas.reduce((s, l) => s + l.precio * l.cantidad, 0)
                  - Number(form.descuento.value || 0);
    notificar(`Venta N° ${id} registrada · ${util.bs(Math.max(total, 0))} cobrados.`);
    abrirModulo('ventas');
  }, '🛒 Vender');

  buscarProductoVenta();
  setTimeout(() => document.getElementById('buscarVenta')?.focus(), 150);
}

/** Filtra el catálogo mientras se escribe. */
function buscarProductoVenta() {
  const caja = document.getElementById('resultadosVenta');
  if (!caja) return;
  const q = (document.getElementById('buscarVenta')?.value || '').trim().toLowerCase();

  // Sin texto: no se llena la pantalla de productos
  if (!q) {
    caja.innerHTML = '<p class="subtexto" style="padding:4px 0 12px">' +
      'Escribe el nombre del producto para encontrarlo.</p>';
    return;
  }

  const hallados = ventaCatalogo
    .filter(p => (p.nombre + ' ' + p.categoria).toLowerCase().includes(q))
    .slice(0, 8);

  caja.innerHTML = hallados.length ? hallados.map(p => {
    const yaEn = ventaLineas.find(l => l.id === p.id);
    const libre = p.stock - (yaEn?.cantidad || 0);
    return `
      <button type="button" class="resultado-item" ${libre <= 0 ? 'disabled' : ''}
              onclick="agregarLineaVenta(${p.id})">
        <span class="nombre">${p.nombre}</span>
        <span class="datos">${util.bs(p.precio_venta)} ·
          ${libre > 0 ? `quedan ${libre}` : '<span style="color:#ff8a8f">sin stock</span>'}</span>
      </button>`;
  }).join('')
    : `<p class="subtexto" style="padding:4px 0 12px">No hay productos que digan “${q}”.</p>`;
}

/** Agrega el producto a la venta (o suma uno más si ya estaba). */
function agregarLineaVenta(id) {
  const p = ventaCatalogo.find(x => x.id === id);
  if (!p) return;
  const linea = ventaLineas.find(l => l.id === id);

  if (linea) {
    if (linea.cantidad >= p.stock) { notificar(`Solo quedan ${p.stock} de ${p.nombre}.`, true); return; }
    linea.cantidad++;
  } else {
    if (p.stock <= 0) { notificar(`${p.nombre} está agotado.`, true); return; }
    ventaLineas.push({ id: p.id, nombre: p.nombre, precio: Number(p.precio_venta), stock: p.stock, cantidad: 1 });
  }

  // Limpiar el buscador para encadenar varios productos rápido
  const buscador = document.getElementById('buscarVenta');
  if (buscador) { buscador.value = ''; buscador.focus(); }
  buscarProductoVenta();
  pintarLineasVenta();
}

function cambiarCantidadVenta(i, delta) {
  const l = ventaLineas[i];
  if (!l) return;
  const nueva = l.cantidad + delta;
  if (nueva <= 0) { ventaLineas.splice(i, 1); }
  else if (nueva > l.stock) { notificar(`Solo quedan ${l.stock} de ${l.nombre}.`, true); return; }
  else { l.cantidad = nueva; }
  pintarLineasVenta();
  buscarProductoVenta();
}

function quitarLineaVenta(i) { ventaLineas.splice(i, 1); pintarLineasVenta(); buscarProductoVenta(); }

function pintarLineasVenta() {
  const cont = document.getElementById('lineasVenta');
  if (!cont) return;

  cont.innerHTML = ventaLineas.length ? `
    <table style="margin-bottom:14px">
      <thead><tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Subtotal</th><th></th></tr></thead>
      <tbody>${ventaLineas.map((l, i) => `
        <tr>
          <td>${l.nombre}</td>
          <td>${util.bs(l.precio)}</td>
          <td><span class="contador">
                <button type="button" onclick="cambiarCantidadVenta(${i}, -1)">−</button>
                <strong>${l.cantidad}</strong>
                <button type="button" onclick="cambiarCantidadVenta(${i}, 1)">＋</button>
              </span></td>
          <td><strong>${util.bs(l.precio * l.cantidad)}</strong></td>
          <td class="acciones"><button type="button" onclick="quitarLineaVenta(${i})">✖️</button></td>
        </tr>`).join('')}
      </tbody>
    </table>`
    : '<p class="subtexto" style="margin-bottom:14px">Sin productos todavía · búscalos arriba y tócalos para agregarlos.</p>';

  const sub = ventaLineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const desc = Number(document.querySelector('#formModal [name="descuento"]')?.value || 0);
  const total = Math.max(sub - desc, 0);
  const unidades = ventaLineas.reduce((s, l) => s + l.cantidad, 0);

  const el = document.getElementById('totalVenta');
  if (el) {
    el.innerHTML = `${util.bs(total)} <small>${unidades} artículo${unidades === 1 ? '' : 's'}` +
      (desc > 0 ? ` · subtotal ${util.bs(sub)} − desc. ${util.bs(desc)}` : '') + `</small>`;
  }

  // El total también va en el botón, que siempre está a la vista
  const btn = document.querySelector('#formModal #btnModalGuardar');
  if (btn) btn.textContent = ventaLineas.length ? `🛒 Vender ${util.bs(total)}` : '🛒 Vender';
}

// ---------------------- ANULAR / ELIMINAR ----------------------

async function anularVenta(id, numero) {
  if (!confirmar(
    `¿Anular la venta N° ${numero}?\n\n` +
    '• Los productos vuelven al stock.\n' +
    '• El cobro sale de la caja (la venta no ocurrió).\n' +
    '• La venta queda registrada como anulada.')) return;
  const r = await db.rpc('anular_venta', { p_venta_id: id, p_usuario_nombre: perfilActual?.nombre || '' });
  if (r.error) { notificar(r.error.message, true); return; }
  notificar('Venta anulada. El stock volvió.');
  abrirModulo('ventas');
}

async function eliminarVenta(id, numero) {
  if (!confirmar(`¿Eliminar la venta N° ${numero} para siempre?\n\nNo quedará ningún rastro. Si solo quieres deshacerla, usa 🚫 Anular.`)) return;
  const r = await db.rpc('eliminar_venta', { p_venta_id: id });
  if (r.error) { notificar(r.error.message, true); return; }
  notificar('Venta eliminada.');
  abrirModulo('ventas');
}
