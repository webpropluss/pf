// ============================================================
// PRIME FIT · Módulo Promociones (productos de regalo)
//
// Lo que se regala en una inauguración, un sorteo o una dinámica.
// Sale del stock igual que una venta, pero NO entra plata: es un
// gasto, no un ingreso. Por eso nunca genera un pago.
// ============================================================

let promoLineas = [];     // lo que se está por regalar
let promoCatalogo = [];   // productos disponibles, para el buscador

// Motivos frecuentes, para no escribirlos cada vez
const MOTIVOS_PROMO = ['Inauguración', 'Sorteo', 'Dinámica de redes',
                       'Cortesía a un alumno', 'Degustación', 'Consumo interno'];

async function cargarPromociones(contenido) {
  const hoy = util.hoy();
  const mes = hoy.slice(0, 7);
  const puedeDeshacer = puedeAccion('anularPromo');

  const promos = verificar(await db.from('promociones')
    .select('*, promocion_detalles(nombre_producto, descripcion_producto, cantidad, precio_venta)')
    .order('id', { ascending: false }).limit(150));

  const vigentes  = promos.filter(p => !p.anulada);
  const deHoy     = vigentes.filter(p => String(p.fecha).slice(0, 10) === hoy);
  const delMes    = vigentes.filter(p => String(p.fecha).slice(0, 7) === mes);
  const gastoHoy  = deHoy.reduce((s, p) => s + Number(p.costo), 0);
  const gastoMes  = delMes.reduce((s, p) => s + Number(p.costo), 0);
  const valorMes  = delMes.reduce((s, p) => s + Number(p.valor_venta), 0);
  const unidades  = (lista) => lista.reduce((s, p) =>
    s + (p.promocion_detalles || []).reduce((t, d) => t + d.cantidad, 0), 0);

  contenido.innerHTML = `
    <header class="cabecera"><h2>Promociones</h2></header>

    <div class="toolbar">
      <button class="btn btn-rojo" onclick="nuevaPromocion()">🎁 Registrar regalo</button>
    </div>

    <div class="tarjetas">
      <div class="tarjeta acento"><div class="etiqueta">Regalado hoy</div>
        <div class="valor">${util.bs(gastoHoy)}</div>
        <div class="subtexto">${unidades(deHoy)} artículo${unidades(deHoy) === 1 ? '' : 's'}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Gasto del mes</div>
        <div class="valor">${util.bs(gastoMes)}</div>
        <div class="subtexto">lo que te costó a ti</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Valor de venta regalado</div>
        <div class="valor">${util.bs(valorMes)}</div>
        <div class="subtexto">lo que habrías cobrado este mes</div></div>
    </div>

    <div class="panel">
      <h3>Historial de regalos</h3>
      ${promos.length ? `
        <table>
          <thead><tr><th>N°</th><th>Fecha</th><th>Motivo</th><th>Productos</th>
                     <th>Costo</th><th>Valor venta</th><th>Registró</th><th></th></tr></thead>
          <tbody>
            ${promos.map(p => `
              <tr style="${p.anulada ? 'opacity:.5' : ''}">
                <td>${p.numero}</td>
                <td>${new Date(p.fecha).toLocaleDateString('es-BO', { day:'2-digit', month:'2-digit', year:'2-digit' })}</td>
                <td><strong>${p.motivo || '—'}</strong>
                    ${p.entregado_a ? `<div class="subtexto">${p.entregado_a}</div>` : ''}
                    ${p.anulada ? '<div><span class="pill pill-rojo">Anulado</span></div>' : ''}</td>
                <td><div class="lineas">${(p.promocion_detalles || []).map(d =>
                      `<span>${d.cantidad}× ${d.nombre_producto}` +
                      (d.descripcion_producto ? ` <span class="subtexto">(${d.descripcion_producto})</span>` : '') +
                      '</span>'
                    ).join('') || '—'}</div></td>
                <td><strong>${util.bs(p.costo)}</strong></td>
                <td class="subtexto">${util.bs(p.valor_venta)}</td>
                <td class="subtexto">${p.usuario_nombre || '—'}</td>
                <td class="acciones">
                  ${puedeDeshacer && !p.anulada
                    ? `<button title="Anular: la mercadería vuelve al stock y el gasto se borra"
                               onclick="anularPromocion(${p.id}, ${p.numero})">🚫<span class="solo-movil"> Anular</span></button>` : ''}
                  ${puedeDeshacer
                    ? `<button title="Eliminar definitivamente"
                               onclick="eliminarPromocion(${p.id}, ${p.numero})">🗑️<span class="solo-movil"> Eliminar</span></button>` : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
        <p class="subtexto" style="margin-top:12px">
          Los regalos <strong>no cuentan como ingreso</strong> en ningún lado: salen del stock
          y se anotan como gasto. El <strong>costo</strong> es lo que te costó al proveedor;
          el <strong>valor de venta</strong> es lo que habrías cobrado.
        </p>`
        : '<p class="cargando">Todavía no se registró ningún regalo.</p>'}
    </div>`;
}

// ---------------------- NUEVO REGALO ----------------------

async function nuevaPromocion() {
  promoCatalogo = verificar(await db.from('productos')
    .select('id, nombre, descripcion, categoria, precio_compra, precio_venta, stock, foto_url')
    .eq('activo', true).order('nombre'));
  promoLineas = [];
  const hoy = util.hoy();

  abrirModal('Registrar regalo', `
    <div class="fila">
      <div class="campo"><label>Motivo</label>
        <input name="motivo" list="motivosPromo" required
               placeholder="Ej. Inauguración" autocomplete="off">
        <datalist id="motivosPromo">
          ${MOTIVOS_PROMO.map(m => `<option value="${m}">`).join('')}
        </datalist></div>
      <div class="campo"><label>Fecha</label>
        <input type="date" name="fecha" value="${hoy}" max="${hoy}">
        <span class="subtexto">Cámbiala si estás cargando un evento de otro día.</span></div>
    </div>

    <div class="campo"><label>Entregado a <span class="subtexto">(opcional)</span></label>
      <input name="entregado_a" placeholder="Ej. sorteo entre los asistentes"></div>

    <div class="campo"><label>Buscar producto</label>
      <input type="search" id="buscarPromo" autocomplete="off"
             placeholder="Escribe: proteína, alfajor, agua…"
             oninput="buscarProductoPromo()">
    </div>
    <div id="resultadosPromo" class="resultados-venta"></div>

    <div id="lineasPromo"></div>

    <div class="total-grande" id="totalPromo">Bs. 0.00 <small>de gasto</small></div>
  `, async (form) => {
    if (!promoLineas.length) throw new Error('Agrega al menos un producto al regalo.');
    if (!form.motivo.value.trim()) throw new Error('Pon el motivo del regalo (inauguración, sorteo…).');

    const numero = verificar(await db.rpc('crear_promocion', {
      p_detalles: promoLineas.map(l => ({ producto_id: l.id, cantidad: l.cantidad })),
      p_motivo: form.motivo.value.trim(),
      p_entregado_a: form.entregado_a.value.trim(),
      p_usuario_nombre: perfilActual?.nombre || '',
      p_fecha: form.fecha.value || null,
    }));

    const costo = promoLineas.reduce((s, l) => s + l.compra * l.cantidad, 0);
    notificar(`Regalo N° ${numero} registrado · ${util.bs(costo)} de gasto promocional.`);
    abrirModulo('promociones');
  }, '🎁 Registrar');

  buscarProductoPromo();
}

/** Filtra el catálogo mientras se escribe. */
function buscarProductoPromo() {
  const caja = document.getElementById('resultadosPromo');
  if (!caja) return;
  const q = (document.getElementById('buscarPromo')?.value || '').trim().toLowerCase();

  if (!q) {
    caja.innerHTML = '<p class="subtexto" style="padding:4px 0 12px">' +
      'Escribe el nombre del producto que vas a regalar.</p>';
    return;
  }

  const hallados = promoCatalogo
    .filter(p => (p.nombre + ' ' + p.categoria + ' ' + (p.descripcion || ''))
      .toLowerCase().includes(q))
    .slice(0, 8);

  caja.innerHTML = hallados.length ? hallados.map(p => {
    const yaEn = promoLineas.find(l => l.id === p.id);
    const libre = p.stock - (yaEn?.cantidad || 0);
    return `
      <button type="button" class="resultado-item" ${libre <= 0 ? 'disabled' : ''}
              onclick="agregarLineaPromo(${p.id})">
        ${fotoProductoHtml(p)}
        <span class="texto">
          <span class="nombre">${p.nombre}</span>
          ${p.descripcion ? `<span class="descripcion">${p.descripcion}</span>` : ''}
          <span class="datos">te cuesta ${util.bs(p.precio_compra)} ·
            ${libre > 0 ? `quedan ${libre}` : '<span style="color:#ff8a8f">sin stock</span>'}</span>
        </span>
      </button>`;
  }).join('')
    : `<p class="subtexto" style="padding:4px 0 12px">No hay productos que digan “${q}”.</p>`;
}

/** Agrega el producto al regalo (o suma uno más si ya estaba). */
function agregarLineaPromo(id) {
  const p = promoCatalogo.find(x => x.id === id);
  if (!p) return;
  const linea = promoLineas.find(l => l.id === id);

  if (linea) {
    if (linea.cantidad >= p.stock) { notificar(`Solo quedan ${p.stock} de ${p.nombre}.`, true); return; }
    linea.cantidad++;
  } else {
    if (p.stock <= 0) { notificar(`${p.nombre} está agotado.`, true); return; }
    promoLineas.push({ id: p.id, nombre: p.nombre, foto_url: p.foto_url, stock: p.stock,
                       compra: Number(p.precio_compra), venta: Number(p.precio_venta), cantidad: 1 });
  }

  const buscador = document.getElementById('buscarPromo');
  if (buscador) { buscador.value = ''; buscador.focus(); }
  buscarProductoPromo();
  pintarLineasPromo();
}

function cambiarCantidadPromo(i, delta) {
  const l = promoLineas[i];
  if (!l) return;
  const nueva = l.cantidad + delta;
  if (nueva <= 0) { promoLineas.splice(i, 1); }
  else if (nueva > l.stock) { notificar(`Solo quedan ${l.stock} de ${l.nombre}.`, true); return; }
  else { l.cantidad = nueva; }
  pintarLineasPromo();
  buscarProductoPromo();
}

function quitarLineaPromo(i) { promoLineas.splice(i, 1); pintarLineasPromo(); buscarProductoPromo(); }

function pintarLineasPromo() {
  const cont = document.getElementById('lineasPromo');
  if (!cont) return;

  cont.innerHTML = promoLineas.length ? `
    <table style="margin-bottom:14px">
      <thead><tr><th></th><th>Producto</th><th>Te cuesta</th><th>Cantidad</th><th>Gasto</th><th></th></tr></thead>
      <tbody>${promoLineas.map((l, i) => `
        <tr>
          <td>${fotoProductoHtml(l)}</td>
          <td>${l.nombre}</td>
          <td>${util.bs(l.compra)}</td>
          <td><span class="contador">
                <button type="button" onclick="cambiarCantidadPromo(${i}, -1)">−</button>
                <strong>${l.cantidad}</strong>
                <button type="button" onclick="cambiarCantidadPromo(${i}, 1)">＋</button>
              </span></td>
          <td><strong>${util.bs(l.compra * l.cantidad)}</strong></td>
          <td class="acciones"><button type="button" onclick="quitarLineaPromo(${i})">✖️</button></td>
        </tr>`).join('')}
      </tbody>
    </table>`
    : '<p class="subtexto" style="margin-bottom:14px">Sin productos todavía · búscalos arriba y tócalos para agregarlos.</p>';

  const costo = promoLineas.reduce((s, l) => s + l.compra * l.cantidad, 0);
  const valor = promoLineas.reduce((s, l) => s + l.venta  * l.cantidad, 0);
  const unidades = promoLineas.reduce((s, l) => s + l.cantidad, 0);

  const el = document.getElementById('totalPromo');
  if (el) {
    el.innerHTML = `${util.bs(costo)} <small>de gasto · ${unidades} artículo${unidades === 1 ? '' : 's'}` +
      (valor > 0 ? ` · valor de venta ${util.bs(valor)}` : '') + `</small>`;
  }

  const btn = document.querySelector('#formModal #btnModalGuardar');
  if (btn) btn.textContent = promoLineas.length ? `🎁 Registrar ${util.bs(costo)}` : '🎁 Registrar';
}

// ---------------------- ANULAR / ELIMINAR ----------------------

async function anularPromocion(id, numero) {
  if (!confirmar(
    `¿Anular el regalo N° ${numero}?\n\n` +
    '• La mercadería vuelve al stock.\n' +
    '• El gasto promocional se borra (el regalo no ocurrió).\n' +
    '• Queda registrado como anulado.')) return;
  const r = await db.rpc('anular_promocion', { p_promocion_id: id, p_usuario_nombre: perfilActual?.nombre || '' });
  if (r.error) { notificar(r.error.message, true); return; }
  notificar('Regalo anulado. El stock volvió.');
  abrirModulo('promociones');
}

async function eliminarPromocion(id, numero) {
  if (!confirmar(`¿Eliminar el regalo N° ${numero} para siempre?\n\nNo quedará ningún rastro. Si solo quieres deshacerlo, usa 🚫 Anular.`)) return;
  const r = await db.rpc('eliminar_promocion', { p_promocion_id: id });
  if (r.error) { notificar(r.error.message, true); return; }
  notificar('Regalo eliminado.');
  abrirModulo('promociones');
}
