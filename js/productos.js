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
      <td><strong>${p.nombre}</strong><div class="subtexto">${p.codigo} · ${p.categoria}</div></td>
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
        <button title="Editar" onclick="dialogoProducto(${p.id})">✏️</button>
        <button title="Reponer o corregir stock" onclick="dialogoStock(${p.id})">📦</button>
        <button title="${p.activo ? 'Retirar de la venta' : 'Volver a vender'}"
                onclick="alternarProducto(${p.id}, ${p.activo})">${p.activo ? '🚫' : '♻️'}</button>
        <button title="Eliminar definitivamente" onclick="eliminarProducto(${p.id}, '${p.nombre.replace(/'/g, '')}')">🗑️</button>
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
        📦 repone o corrige el stock · 🚫 lo retira de la venta sin borrar su historial ·
        🗑️ lo elimina (solo si nunca se vendió).
      </p>
    </div>`;

  const repintar = () => {
    const q = document.getElementById('buscarProducto').value.toLowerCase();
    const cat = document.getElementById('filtroCategoria').value;
    document.getElementById('tbodyProductos').innerHTML = filas(productos.filter(p =>
      (p.nombre + p.codigo + p.categoria).toLowerCase().includes(q) &&
      (!cat || p.categoria === cat)));
  };
  document.getElementById('buscarProducto').addEventListener('input', repintar);
  document.getElementById('filtroCategoria').addEventListener('change', repintar);
}

async function dialogoProducto(id) {
  const p = id
    ? verificar(await db.from('productos').select('*').eq('id', id).single())
    : { nombre: '', categoria: 'Suplementos', precio_compra: '', precio_venta: '', stock: 0, stock_minimo: 3 };

  abrirModal(id ? 'Editar producto' : 'Nuevo producto', `
    <div class="campo"><label>Nombre</label>
      <input name="nombre" required placeholder="Ej. Agua 600 ml" value="${p.nombre}"></div>

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

    <div class="fila">
      <div class="campo"><label>Stock ${id ? '<span class="subtexto">(se ajusta con 📦)</span>' : 'inicial'}</label>
        <input type="number" name="stock" min="0" value="${p.stock}" ${id ? 'disabled' : ''}></div>
      <div class="campo"><label>Avisar cuando queden</label>
        <input type="number" name="stock_minimo" min="0" value="${p.stock_minimo}"></div>
    </div>

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
    <p class="subtexto" style="margin-bottom:14px">Stock actual: <strong>${p.stock}</strong></p>
    <div class="fila">
      <div class="campo"><label>Llegaron (sumar)</label>
        <input type="number" id="stockSuma" min="0" placeholder="0" oninput="previsualizarStock(${p.stock})"></div>
      <div class="campo"><label>o dejar el total en</label>
        <input type="number" name="nuevo" min="0" value="${p.stock}" oninput="document.getElementById('stockSuma').value=''"></div>
    </div>
    <div class="campo"><label>Motivo</label>
      <input name="motivo" placeholder="Ej. llegó pedido del proveedor"></div>
  `, async (form) => {
    const nuevo = Number(form.nuevo.value);
    if (isNaN(nuevo) || nuevo < 0) throw new Error('El stock no puede ser negativo.');
    const r = await db.rpc('ajustar_stock', {
      p_producto_id: id, p_nuevo_stock: nuevo,
      p_motivo: form.motivo.value.trim(),
      p_usuario: perfilActual?.nombre || '',
    });
    if (r.error) throw new Error(r.error.message);
    notificar(`Stock de ${p.nombre}: ahora hay ${nuevo}.`);
    abrirModulo('productos');
  }, 'Guardar stock');
}

/** Al escribir cuántos llegaron, calcula el total solo. */
function previsualizarStock(actual) {
  const suma = Number(document.getElementById('stockSuma').value || 0);
  const campo = document.querySelector('#formModal [name="nuevo"]');
  if (campo) campo.value = actual + suma;
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
