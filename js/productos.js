// ============================================================
// PRIME FIT · Módulo Productos (solo administrador)
// Aquí se cargan los productos con su stock, el precio al que se
// compran al proveedor y el precio al que se venden.
// ============================================================

const CATEGORIAS = ['Suplementos', 'Bebidas', 'Accesorios', 'Ropa', 'Otros'];

/** Miniatura del producto (o un ícono si no tiene foto). */
function fotoProductoHtml(p, clase = 'foto-mini') {
  return p.foto_url
    ? `<span class="${clase}"><img src="${p.foto_url}" alt="" loading="lazy"></span>`
    : `<span class="${clase}"><span class="sin-foto">📦</span></span>`;
}

async function cargarProductos(contenido) {
  const productos = verificar(await db.from('productos').select('*').order('categoria').order('nombre'));

  const valorInventario = productos
    .filter(p => p.activo)
    .reduce((s, p) => s + Number(p.precio_compra) * p.stock, 0);
  const porAgotarse = productos.filter(p => p.activo && p.stock <= p.stock_minimo);

  const filas = (lista) => lista.map(p => {
    const margen = Number(p.precio_venta) - Number(p.precio_compra);
    const pct = Number(p.precio_venta) > 0 ? Math.round(margen / Number(p.precio_venta) * 100) : 0;
    const bajo = p.stock <= p.stock_minimo;
    return `
    <tr>
      <td>${fotoProductoHtml(p)}</td>
      <td><strong>${p.nombre}</strong>
          ${p.descripcion ? `<div class="descripcion">${p.descripcion}</div>` : ''}
          <div class="subtexto">${p.codigo} · ${p.categoria}</div></td>
      <td>${util.bs(p.precio_compra)}</td>
      <td><strong>${util.bs(p.precio_venta)}</strong></td>
      <td>${util.bs(margen)} <span class="subtexto">(${pct}%)</span></td>
      <td>${p.stock === 0
            ? '<span class="pill pill-rojo">Agotado</span>'
            : bajo ? `<span class="pill pill-amarillo">${p.stock} · queda poco</span>`
                   : `<strong>${p.stock}</strong>`}</td>
      <td>${p.activo ? '<span class="pill pill-verde">A la venta</span>'
                     : '<span class="pill pill-rojo">Retirado</span>'}</td>
      <td class="acciones">
        <button title="Editar nombre y precios" onclick="dialogoProducto(${p.id})">✏️<span class="solo-movil"> Editar</span></button>
        <button title="Reponer o corregir stock" onclick="dialogoStock(${p.id})">📦<span class="solo-movil"> Stock</span></button>
        <button title="${p.activo ? 'Retirar de la venta' : 'Volver a vender'}"
                onclick="alternarProducto(${p.id}, ${p.activo})">${p.activo ? '🚫' : '♻️'}<span class="solo-movil"> ${p.activo ? 'Retirar' : 'Volver a vender'}</span></button>
        <button title="Eliminar definitivamente" onclick="eliminarProducto(${p.id}, '${p.nombre.replace(/'/g, '')}')">🗑️<span class="solo-movil"> Eliminar</span></button>
      </td>
    </tr>`; }).join('');

  contenido.innerHTML = `
    <header class="cabecera"><h2>Productos</h2></header>

    <div class="tarjetas">
      <div class="tarjeta acento"><div class="etiqueta">Productos a la venta</div>
        <div class="valor">${productos.filter(p => p.activo).length}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Invertido en mercadería</div>
        <div class="valor">${util.bs(valorInventario)}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Por reponer</div>
        <div class="valor">${porAgotarse.length}</div></div>
    </div>

    ${porAgotarse.length ? `
      <div class="panel">
        <h3>📦 Se están acabando</h3>
        <p class="subtexto">${porAgotarse.map(p => `${p.nombre} (${p.stock})`).join(' · ')}</p>
      </div>` : ''}

    <div class="toolbar">
      <input type="search" id="buscarProducto" placeholder="Buscar producto…">
      <select id="filtroCategoria">
        <option value="">Todas las categorías</option>
        ${CATEGORIAS.map(c => `<option>${c}</option>`).join('')}
      </select>
      <button class="btn btn-rojo" onclick="dialogoProducto()">＋ Nuevo producto</button>
    </div>

    <div class="panel">
      <table>
        <thead><tr><th></th><th>Producto</th><th>Compra</th><th>Venta</th><th>Ganancia</th>
                   <th>Stock</th><th>Estado</th><th></th></tr></thead>
        <tbody id="tbodyProductos">${filas(productos)}</tbody>
      </table>
      <p class="subtexto" style="margin-top:12px">
        ¿Compraste más mercadería? Toca <strong>📦 Stock</strong> en ese producto.
        <strong>🚫 Retirar</strong> lo saca de la venta pero guarda su historial ·
        <strong>🗑️ Eliminar</strong> solo funciona si nunca se vendió.
      </p>
    </div>`;

  const repintar = () => {
    const q = document.getElementById('buscarProducto').value.toLowerCase();
    const cat = document.getElementById('filtroCategoria').value;
    document.getElementById('tbodyProductos').innerHTML = filas(productos.filter(p =>
      (p.nombre + p.codigo + p.categoria + ' ' + (p.descripcion || '')).toLowerCase().includes(q) &&
      (!cat || p.categoria === cat)));
  };
  document.getElementById('buscarProducto').addEventListener('input', repintar);
  document.getElementById('filtroCategoria').addEventListener('change', repintar);
}

async function dialogoProducto(id) {
  const p = id
    ? verificar(await db.from('productos').select('*').eq('id', id).single())
    : { nombre: '', descripcion: '', categoria: 'Suplementos', precio_compra: '', precio_venta: '', stock: 0, stock_minimo: 3 };

  abrirModal(id ? 'Editar producto' : 'Nuevo producto', `
    <div class="campo"><label>Nombre</label>
      <input name="nombre" required placeholder="Ej. Agua 600 ml" value="${p.nombre}"></div>

    <div class="campo"><label>Descripción <span class="subtexto">(opcional)</span></label>
      <textarea name="descripcion" rows="2" maxlength="300"
                placeholder="Ej. Bucal doble, para boxeo · con estuche">${p.descripcion || ''}</textarea>
      <span class="subtexto">Sirve para distinguir productos parecidos: sabor, tamaño,
        para qué es. Se ve en el buscador de la caja.</span></div>

    <div class="campo"><label>Categoría</label>
      <select name="categoria">
        ${CATEGORIAS.map(c => `<option ${c === p.categoria ? 'selected' : ''}>${c}</option>`).join('')}
      </select></div>

    <div class="fila">
      <div class="campo"><label>Precio de compra (Bs.)</label>
        <input type="number" name="precio_compra" min="0" step="0.01" required
               value="${p.precio_compra}" oninput="calcularMargen()">
        <span class="subtexto">Lo que te cuesta al proveedor.</span></div>
      <div class="campo"><label>Precio de venta (Bs.)</label>
        <input type="number" name="precio_venta" min="0" step="0.01" required
               value="${p.precio_venta}" oninput="calcularMargen()">
        <span class="subtexto">Lo que le cobras al cliente.</span></div>
    </div>
    <p class="subtexto" id="margenAviso" style="margin:-8px 0 14px"></p>

    ${id ? `
    <div class="campo"><label>Stock</label>
      <div class="stock-aviso">
        <span>Ahora hay <strong>${p.stock}</strong> unidad${p.stock === 1 ? '' : 'es'}</span>
        <button type="button" class="btn btn-oscuro" onclick="irAStockDesdeProducto(${id})">
          📦 Reponer o corregir</button>
      </div>
      <span class="subtexto">¿Compraste más? Toca <strong>Reponer o corregir</strong>: ahí pones
        cuántas llegaron y por qué. Se hace en su propia pantalla para que quede anotado
        cada movimiento y después puedas saber de dónde salió cada unidad.</span></div>

    <div class="campo"><label>Avisar cuando queden</label>
      <input type="number" name="stock_minimo" min="0" value="${p.stock_minimo}"></div>
    ` : `
    <div class="fila">
      <div class="campo"><label>Stock inicial</label>
        <input type="number" name="stock" min="0" value="${p.stock}"></div>
      <div class="campo"><label>Avisar cuando queden</label>
        <input type="number" name="stock_minimo" min="0" value="${p.stock_minimo}"></div>
    </div>`}

    <div class="campo"><label>Foto <span class="subtexto">(opcional)</span></label>
      <div class="foto-campo">
        <div class="foto-vista" id="vistaFoto">
          ${p.foto_url ? `<img src="${p.foto_url}" alt="">` : '<span>📦</span>'}
        </div>
        <div style="flex:1;min-width:0">
          <input type="file" name="foto" accept="image/*"
                 onchange="previsualizarFoto(this, 'avisoFoto', 'vistaFoto')">
          <span class="subtexto" id="avisoFoto">Se comprime sola antes de subirla.
            Sirve para distinguir productos parecidos.</span>
        </div>
      </div>
      ${p.foto_url ? `<label class="quitar-foto">
          <input type="checkbox" name="quitar_foto"> Quitar la foto actual</label>` : ''}
    </div>
  `, async (form) => {
    const compra = Number(form.precio_compra.value);
    const venta  = Number(form.precio_venta.value);
    if (venta < compra && !confirmar(
      `El precio de venta (${util.bs(venta)}) es MENOR al de compra (${util.bs(compra)}).\n\n` +
      'Estarías perdiendo dinero en cada venta. ¿Guardar igual?')) return;

    const datos = {
      nombre: form.nombre.value.trim(),
      descripcion: form.descripcion.value.trim(),
      categoria: form.categoria.value,
      precio_compra: compra,
      precio_venta: venta,
      stock_minimo: Number(form.stock_minimo.value || 0),
    };

    // Foto: se comprime en el teléfono y se sube ya liviana
    const archivo = form.foto.files[0];
    if (archivo) {
      const { url, kb } = await subirFoto(archivo, 'fotos-productos', 'prod', 500);
      datos.foto_url = url;
      if (p.foto_url) await borrarFoto(p.foto_url, 'fotos-productos');  // la vieja ya no sirve
      notificar(`Foto subida (${kb} KB).`);
    } else if (form.quitar_foto?.checked) {
      datos.foto_url = null;
      await borrarFoto(p.foto_url, 'fotos-productos');
    }

    if (id) {
      verificar(await db.from('productos').update(datos).eq('id', id));
    } else {
      datos.codigo = await siguienteCodigo('productos', 'PRO');
      datos.stock = Number(form.stock.value || 0);
      verificar(await db.from('productos').insert(datos));
    }
    notificar(id ? 'Producto actualizado.' : 'Producto agregado.');
    abrirModulo('productos');
  });
  calcularMargen();
}

/**
 * Va del formulario del producto a la pantalla de stock.
 * Avisa antes si había cambios escritos, para no perderlos sin querer.
 */
function irAStockDesdeProducto(id) {
  const f = document.getElementById('formModal');
  const sucio = f && [...f.elements].some(el =>
    el.name && el.type !== 'file' && typeof el.defaultValue === 'string' &&
    el.value !== el.defaultValue);
  if (sucio && !confirmar(
    'Tienes cambios sin guardar en este producto.\n\n' +
    'Si pasas al stock ahora, esos cambios se pierden.\n' +
    '¿Continuar de todos modos?')) return;
  dialogoStock(id);
}

/** Muestra la ganancia mientras se escriben los precios. */
function calcularMargen() {
  const f = document.getElementById('formModal');
  const aviso = document.getElementById('margenAviso');
  if (!f || !aviso) return;
  const c = Number(f.precio_compra?.value || 0);
  const v = Number(f.precio_venta?.value || 0);
  if (!c && !v) { aviso.textContent = ''; return; }
  const g = v - c;
  const pct = v > 0 ? Math.round(g / v * 100) : 0;
  aviso.innerHTML = g >= 0
    ? `Ganas <strong style="color:var(--verde)">${util.bs(g)}</strong> por unidad (${pct}% del precio de venta).`
    : `<span style="color:#ff8a8f">Pierdes ${util.bs(-g)} por unidad.</span>`;
}

/** Reponer mercadería o corregir el stock. */
async function dialogoStock(id) {
  const p = verificar(await db.from('productos').select('nombre, stock').eq('id', id).single());

  abrirModal(`Stock de ${p.nombre}`, `
    <p style="margin-bottom:16px">Ahora hay <strong>${p.stock}</strong>
      unidad${p.stock === 1 ? '' : 'es'}.</p>

    <div class="campo"><label>¿Cuántas llegaron?</label>
      <input type="number" id="stockSuma" min="0" placeholder="Ej. 12"
             oninput="previsualizarStock(${p.stock})">
      <span class="subtexto">Esto es lo que usas cuando compras más al proveedor:
        se suman a las que ya tenías.</span></div>

    <div class="campo"><label>O deja el total exacto en</label>
      <input type="number" name="nuevo" min="0" value="${p.stock}"
             oninput="document.getElementById('stockSuma').value=''; previsualizarStock(${p.stock}, true)">
      <span class="subtexto">Para cuando contaste la mercadería y no cuadra, o se rompió algo.</span></div>

    <div class="campo"><label>Motivo</label>
      <input name="motivo" placeholder="Ej. llegó pedido del proveedor"></div>

    <div class="total-grande" id="stockResultado"></div>
  `, async (form) => {
    const nuevo = Number(form.nuevo.value);
    if (isNaN(nuevo) || nuevo < 0) throw new Error('El stock no puede ser negativo.');
    const r = await db.rpc('ajustar_stock', {
      p_producto_id: id, p_nuevo_stock: nuevo,
      p_motivo: form.motivo.value.trim(),
      p_usuario: perfilActual?.nombre || '',
    });
    if (r.error) throw new Error(r.error.message);
    notificar(nuevo > p.stock
      ? `${p.nombre}: entraron ${nuevo - p.stock}, ahora hay ${nuevo}.`
      : `Stock de ${p.nombre}: ahora hay ${nuevo}.`);
    abrirModulo('productos');
  }, 'Guardar stock');
  previsualizarStock(p.stock, true);
}

/**
 * Mantiene los dos campos de acuerdo y muestra cómo queda el stock.
 * @param {number}  actual      unidades que hay ahora
 * @param {boolean} soloMostrar true si el usuario escribió el total a mano
 */
function previsualizarStock(actual, soloMostrar = false) {
  const campo = document.querySelector('#formModal [name="nuevo"]');
  if (!campo) return;

  if (!soloMostrar) {
    const suma = Number(document.getElementById('stockSuma')?.value || 0);
    campo.value = actual + suma;
  }

  const aviso = document.getElementById('stockResultado');
  if (!aviso) return;
  const nuevo = Number(campo.value || 0);
  const dif = nuevo - actual;
  aviso.innerHTML = `${nuevo} <small>` + (
    dif > 0 ? `entran ${dif} · antes había ${actual}`
    : dif < 0 ? `salen ${-dif} · antes había ${actual}`
    : 'sin cambios') + '</small>';
}

async function alternarProducto(id, activo) {
  verificar(await db.from('productos').update({ activo: !activo }).eq('id', id));
  notificar(activo ? 'Producto retirado de la venta.' : 'Producto de nuevo a la venta.');
  abrirModulo('productos');
}

async function eliminarProducto(id, nombre) {
  if (!confirmar(`¿Eliminar "${nombre}" para siempre?\n\nSi ya se vendió alguna vez, el sistema no lo dejará (usa 🚫 Retirar).`)) return;
  const prod = verificar(await db.from('productos').select('foto_url').eq('id', id).single());
  const r = await db.rpc('eliminar_producto', { p_id: id });
  if (r.error) { notificar(r.error.message, true); return; }
  await borrarFoto(prod?.foto_url, 'fotos-productos');
  notificar('Producto eliminado.');
  abrirModulo('productos');
}
