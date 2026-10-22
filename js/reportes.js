// ============================================================
// PRIME FIT · Módulo Reportes (con exportación real a Excel)
//
// Se puede ver todo junto o filtrar por una disciplina. Al filtrar
// se ve, de esa disciplina: cuántos se inscribieron, cuánto generó
// en mensualidades y cuánto en pases del día.
//
// Los inscritos se cuentan por DISCIPLINA, no por horario: si un
// alumno lleva dos horarios de boxeo, es un inscrito, no dos.
// ============================================================

let repDisciplinas = [];   // catálogos, para los filtros
let repInstructores = [];
let repVista = 'general';  // 'general' (inscripciones y pases) | 'ventas' (productos)

async function cargarReportes(contenido) {
  const hoy = util.hoy();
  const inicioMes = hoy.slice(0, 8) + '01';
  // El reporte de ventas muestra costos y ganancias: solo para quien puede verlos
  const verVentas = puedeAccion('verGanancias');
  if (!verVentas) repVista = 'general';

  [repDisciplinas, repInstructores] = await Promise.all([
    db.from('disciplinas').select('id, nombre').order('nombre').then(verificar),
    db.from('instructores').select('id, nombre').order('nombre').then(verificar),
  ]);

  const pestana = (vista, texto) =>
    `<button type="button" class="chip-periodo ${repVista === vista ? 'activo' : ''}"
             data-vista="${vista}" onclick="repCambiarVista('${vista}')">${texto}</button>`;

  contenido.innerHTML = `
    <header class="cabecera"><h2>Reportes</h2></header>
    ${verVentas ? `
    <div class="filtro-periodo">
      ${pestana('general', '📋 Inscripciones y pases')}
      ${pestana('ventas', '🛒 Ventas de productos')}
    </div>` : ''}
    <div class="toolbar">
      <label class="subtexto">Desde</label><input type="date" id="repDesde" value="${inicioMes}">
      <label class="subtexto">Hasta</label><input type="date" id="repHasta" value="${hoy}">
      <select id="repDisciplina" onchange="generarReporte()" ${repVista === 'ventas' ? 'hidden' : ''}>
        <option value="">Todas las disciplinas</option>
        ${repDisciplinas.map(d => `<option value="${d.id}">${d.nombre}</option>`).join('')}
      </select>
      <select id="repInstructor" onchange="generarReporte()" ${repVista === 'ventas' ? 'hidden' : ''}>
        <option value="">Todos los instructores</option>
        ${repInstructores.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('')}
      </select>
      <button class="btn btn-rojo" onclick="generarReporte()">Generar</button>
      <button class="btn btn-oscuro" onclick="exportarExcel()">📥 Exportar a Excel</button>
    </div>
    <div id="repResultado"><p class="cargando">Elige el rango de fechas y presiona Generar.</p></div>`;

  generarReporte();
}

/** Cambia de pestaña sin perder las fechas elegidas. */
function repCambiarVista(vista) {
  repVista = vista;
  document.querySelectorAll('[data-vista]').forEach(b =>
    b.classList.toggle('activo', b.dataset.vista === vista));
  ['repDisciplina', 'repInstructor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = vista === 'ventas';
  });
  generarReporte();
}

let repDatos = null; // guarda el último reporte generado para exportarlo

async function generarReporte() {
  if (repVista === 'ventas') return generarReporteVentas();
  const desde = document.getElementById('repDesde').value;
  const hasta = document.getElementById('repHasta').value;
  const disId = document.getElementById('repDisciplina')?.value || '';
  const insId = document.getElementById('repInstructor')?.value || '';
  const cont = document.getElementById('repResultado');

  if (desde > hasta) { notificar('La fecha "desde" es posterior a la "hasta".', true); return; }
  cont.innerHTML = '<p class="cargando">Generando…</p>';

  const [pagos, inscripciones, pases] = await Promise.all([
    // pagos.fecha lleva hora: los límites van con el huso horario de aquí
    db.from('pagos').select('*, alumnos(nombre)')
      .gte('fecha', util.desdeISO(desde)).lte('fecha', util.hastaISO(hasta)).order('fecha'),
    // Las inscripciones se cuentan por CUÁNDO EMPIEZA la mensualidad,
    // igual que en el Dashboard. fecha_inicio es una fecha suelta.
    db.from('inscripciones')
      .select('*, alumnos(nombre), inscripcion_detalles(disciplina_id, horario_id, ' +
              'precio_mensual, precio_lista, meses, disciplinas(nombre), ' +
              'horarios(dias, hora_inicio, instructor_id, instructores(nombre)))')
      .eq('anulada', false).gte('fecha_inicio', desde).lte('fecha_inicio', hasta),
    db.from('pases_dia')
      .select('*, disciplinas(nombre), ' +
              'horarios(disciplina_id, instructor_id, dias, hora_inicio, ' +
              'disciplinas(nombre), instructores(nombre))')
      .gte('fecha', desde).lte('fecha', hasta).order('fecha'),
  ]);

  const listaIns   = inscripciones.data || [];
  const listaPases = pases.data || [];
  const listaPagos = pagos.data || [];

  /** Disciplina de un pase (los viejos la traían por el horario). */
  const disDePase = (p) => p.disciplina_id || p.horarios?.disciplina_id || null;
  const nombreDePase = (p) => p.disciplinas?.nombre || p.horarios?.disciplinas?.nombre || '—';

  // ---------- Resumen por disciplina ----------
  // Para cada una: facturado en mensualidades, inscritos distintos,
  // y lo cobrado en pases del día.
  const resumen = {};   // id → { nombre, mensualidades, alumnos:Set, pases, bsPases }
  const caja = (id, nombre) => (resumen[id] = resumen[id] ||
    { nombre, mensualidades: 0, alumnos: new Set(), pases: 0, bsPases: 0 });

  let descuentosDados = 0;
  listaIns.forEach(i => (i.inscripcion_detalles || []).forEach(d => {
    const c = caja(d.disciplina_id ?? '—', d.disciplinas?.nombre || '—');
    const cobrado = Number(d.precio_mensual);
    const lista   = Number(d.precio_lista ?? d.precio_mensual);
    c.mensualidades += cobrado * d.meses;
    // Set: el mismo alumno con dos horarios de la misma disciplina cuenta una vez
    c.alumnos.add(i.alumno_id);
    descuentosDados += Math.max(lista - cobrado, 0) * d.meses;
  }));

  listaPases.forEach(p => {
    const c = caja(disDePase(p) ?? '—', nombreDePase(p));
    c.pases++;
    c.bsPases += Number(p.monto);
  });

  const filasResumen = Object.entries(resumen)
    .map(([id, c]) => ({ id, nombre: c.nombre, mensualidades: c.mensualidades,
                         inscritos: c.alumnos.size, pases: c.pases, bsPases: c.bsPases,
                         total: c.mensualidades + c.bsPases }))
    .sort((a, b) => b.total - a.total);

  // ---------- Resumen por instructor ----------
  // Sale del horario de cada línea. Los pases del día NO entran aquí:
  // desde que el formulario se simplificó no guardan instructor.
  const porInstructor = {};
  listaIns.forEach(i => (i.inscripcion_detalles || []).forEach(d => {
    const id = d.horarios?.instructor_id ?? '—';
    const c = porInstructor[id] = porInstructor[id] ||
      { nombre: d.horarios?.instructores?.nombre || 'Sin instructor',
        mensualidades: 0, alumnos: new Set(), clases: 0 };
    c.mensualidades += Number(d.precio_mensual) * d.meses;
    c.alumnos.add(i.alumno_id);
    c.clases++;
  }));
  // Los pases que tienen horario también se le atribuyen a su instructor.
  // Los viejos sin horario quedan en "Sin instructor", que es la verdad.
  listaPases.forEach(p => {
    const id = p.horarios?.instructor_id ?? '—';
    const c = porInstructor[id] = porInstructor[id] ||
      { nombre: p.horarios?.instructores?.nombre || 'Sin instructor',
        mensualidades: 0, alumnos: new Set(), clases: 0, pases: 0, bsPases: 0 };
    c.pases = (c.pases || 0) + 1;
    c.bsPases = (c.bsPases || 0) + Number(p.monto);
  });

  const filasInstructor = Object.values(porInstructor)
    .map(c => ({ nombre: c.nombre, mensualidades: c.mensualidades,
                 inscritos: c.alumnos.size, clases: c.clases,
                 pases: c.pases || 0, bsPases: c.bsPases || 0,
                 total: c.mensualidades + (c.bsPases || 0) }))
    .sort((a, b) => b.total - a.total);

  // ---------- Filtros ----------
  const nombreDis = repDisciplinas.find(d => String(d.id) === String(disId))?.nombre || '';
  const nombreIns = repInstructores.find(i => String(i.id) === String(insId))?.nombre || '';
  const hayFiltro = !!(disId || insId);

  /** ¿Esta línea de inscripción pasa los dos filtros a la vez? */
  const lineaPasa = (d) =>
    (!disId || String(d.disciplina_id) === String(disId)) &&
    (!insId || String(d.horarios?.instructor_id) === String(insId));

  const insFiltradas = hayFiltro
    ? listaIns.filter(i => (i.inscripcion_detalles || []).some(lineaPasa))
    : listaIns;

  // Ahora el pase guarda su horario, así que sí se puede saber de qué
  // instructor fue. Los pases viejos, sin horario, no se le atribuyen
  // a nadie: quedan fuera cuando se filtra por instructor.
  const pasesFiltrados = listaPases.filter(p =>
    (!disId || String(disDePase(p)) === String(disId)) &&
    (!insId || String(p.horarios?.instructor_id) === String(insId)));

  // ¿Hay pases del rango que el filtro de instructor deja fuera por no
  // tener horario? Conviene decirlo, para que el número no engañe.
  const pasesSinHorario = insId
    ? listaPases.filter(p => !p.horarios &&
        (!disId || String(disDePase(p)) === String(disId))).length
    : 0;

  const titulo = [nombreDis, nombreIns].filter(Boolean).join(' · ');
  repDatos = { tipo: 'general', desde, hasta, filtro: titulo || 'Todas',
               pagos: listaPagos, inscripciones: insFiltradas,
               pases: pasesFiltrados, resumen: filasResumen,
               instructores: filasInstructor };

  cont.innerHTML = hayFiltro
    ? vistaFiltrada({ titulo, nombreDis, nombreIns, pasesSinHorario },
                    insFiltradas, pasesFiltrados, lineaPasa, desde, hasta)
    : vistaGeneral(listaPagos, listaIns, filasResumen, filasInstructor, descuentosDados);
}

// ---------------------- VISTA GENERAL ----------------------

function vistaGeneral(pagos, inscripciones, resumen, porInstructor, descuentosDados) {
  const totalCobrado   = pagos.reduce((s, p) => s + Number(p.monto), 0);
  const totalFacturado = inscripciones.reduce((s, i) => s + Number(i.total), 0);
  const totalPases     = resumen.reduce((s, r) => s + r.bsPases, 0);

  return `
    <div class="tarjetas">
      <div class="tarjeta acento"><div class="etiqueta">Cobrado en el rango</div>
        <div class="valor">${util.bs(totalCobrado)}</div>
        <div class="subtexto">todo lo que entró a caja</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Facturado (mensualidades)</div>
        <div class="valor">${util.bs(totalFacturado)}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Inscripciones</div>
        <div class="valor">${inscripciones.length}</div>
        <div class="subtexto">que empiezan en el rango</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Pases del día</div>
        <div class="valor">${util.bs(totalPases)}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Descuentos otorgados</div>
        <div class="valor">${util.bs(descuentosDados)}</div></div>
    </div>

    <div class="panel">
      <h3>Por disciplina</h3>
      <table>
        <thead><tr><th>Disciplina</th><th>Inscritos</th><th>Mensualidades</th>
                   <th>Pases</th><th>Total generado</th></tr></thead>
        <tbody>${resumen.map(r => `
          <tr>
            <td><strong>${r.nombre}</strong></td>
            <td>${r.inscritos}</td>
            <td>${util.bs(r.mensualidades)}</td>
            <td>${r.pases ? `${r.pases} · ${util.bs(r.bsPases)}` : '—'}</td>
            <td><strong>${util.bs(r.total)}</strong></td>
          </tr>`).join('') ||
          '<tr><td colspan="5" class="cargando">Sin datos en el rango.</td></tr>'}
        </tbody>
      </table>
      <p class="subtexto" style="margin-top:10px">Elige una disciplina o un instructor arriba para ver su detalle.</p>
    </div>

    <div class="panel">
      <h3>Por instructor</h3>
      <table>
        <thead><tr><th>Instructor</th><th>Alumnos</th><th>Mensualidades</th>
                   <th>Pases</th><th>Total generado</th></tr></thead>
        <tbody>${porInstructor.map(r => `
          <tr>
            <td><strong>${r.nombre}</strong></td>
            <td>${r.inscritos}</td>
            <td>${util.bs(r.mensualidades)}</td>
            <td>${r.pases ? `${r.pases} · ${util.bs(r.bsPases)}` : '—'}</td>
            <td><strong>${util.bs(r.total)}</strong></td>
          </tr>`).join('') ||
          '<tr><td colspan="5" class="cargando">Sin datos en el rango.</td></tr>'}
        </tbody>
      </table>
      <p class="subtexto" style="margin-top:10px">Los pases del día se le atribuyen al
        instructor de su horario. Los registrados sin horario salen como
        <strong>Sin instructor</strong>.</p>
    </div>

    <div class="panel">
      <h3>Pagos del rango (${pagos.length})</h3>
      <table>
        <thead><tr><th>Fecha</th><th>Alumno</th><th>Concepto</th><th>Método</th><th>Monto</th></tr></thead>
        <tbody>${pagos.map(p => `
          <tr><td>${new Date(p.fecha).toLocaleString('es-BO')}</td>
              <td>${p.alumnos?.nombre || '—'}</td><td>${p.concepto}</td>
              <td>${p.metodo}</td><td>${util.bs(p.monto)}</td></tr>`).join('') ||
          '<tr><td colspan="5" class="cargando">Sin pagos en el rango.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

// ---------------------- VISTA FILTRADA ----------------------

function vistaFiltrada(f, inscripciones, pases, lineaPasa, desde, hasta) {
  // Solo las líneas que pasan los filtros, no todas las de esas inscripciones
  const lineas = [];
  inscripciones.forEach(i => (i.inscripcion_detalles || [])
    .filter(lineaPasa)
    .forEach(d => lineas.push({ ins: i, det: d })));

  const mensualidades = lineas.reduce((s, l) => s + Number(l.det.precio_mensual) * l.det.meses, 0);

  // Una fila POR ALUMNO, no por línea: si Juan lleva dos horarios de boxeo
  // es un solo inscrito, y la tabla tiene que decir lo mismo que la tarjeta.
  const porAlumno = new Map();
  lineas.forEach(l => {
    const id = l.ins.alumno_id;
    const a = porAlumno.get(id) || {
      nombre: l.ins.alumnos?.nombre || '—',
      inicio: l.ins.fecha_inicio, vence: l.ins.fecha_fin,
      clases: [], total: 0,
    };
    a.clases.push([
      l.det.disciplinas?.nombre || '',
      l.det.horarios ? `${l.det.horarios.dias} ${l.det.horarios.hora_inicio}` : '',
      l.det.horarios?.instructores?.nombre || '',
    ].filter(Boolean).join(' · '));
    a.total += Number(l.det.precio_mensual) * l.det.meses;
    if (l.ins.fecha_inicio < a.inicio) a.inicio = l.ins.fecha_inicio;
    if (l.ins.fecha_fin   > a.vence)  a.vence  = l.ins.fecha_fin;
    porAlumno.set(id, a);
  });
  const filasAlumno = [...porAlumno.values()].sort((a, b) => b.total - a.total);
  const inscritos = filasAlumno.length;

  const bsPases = pases.reduce((s, p) => s + Number(p.monto), 0);
  const descuentos = lineas.reduce((s, l) =>
    s + Math.max(Number(l.det.precio_lista ?? l.det.precio_mensual) - Number(l.det.precio_mensual), 0) * l.det.meses, 0);

  return `
    <div class="tarjetas">
      <div class="tarjeta acento"><div class="etiqueta">Inscritos</div>
        <div class="valor">${inscritos}</div>
        <div class="subtexto">en ${f.titulo}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Mensualidades</div>
        <div class="valor">${util.bs(mensualidades)}</div>
        <div class="subtexto">${lineas.length} clase${lineas.length === 1 ? '' : 's'}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Pases del día</div>
        <div class="valor">${util.bs(bsPases)}</div>
        <div class="subtexto">${pases.length} pase${pases.length === 1 ? '' : 's'}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Total generado</div>
        <div class="valor">${util.bs(mensualidades + bsPases)}</div>
        <div class="subtexto">${util.fecha(desde)} → ${util.fecha(hasta)}</div></div>
      ${descuentos > 0 ? `
      <div class="tarjeta acento"><div class="etiqueta">Descuentos otorgados</div>
        <div class="valor">${util.bs(descuentos)}</div></div>` : ''}
    </div>

    ${f.pasesSinHorario ? `
      <div class="panel">
        <p class="subtexto" style="margin:0">Hay <strong>${f.pasesSinHorario}
          pase${f.pasesSinHorario === 1 ? '' : 's'} del día sin horario</strong> en este
          rango que no se cuentan aquí: son de antes de que el pase guardara el horario,
          así que no se puede saber qué instructor dio esa clase. Aparecen igual en la
          vista sin filtro de instructor.</p>
      </div>` : ''}

    <div class="panel">
      <h3>Inscritos · ${f.titulo} (${inscritos})</h3>
      <table>
        <thead><tr><th>Alumno</th><th>Clases</th><th>Inicio</th><th>Vence</th><th>Pagó</th></tr></thead>
        <tbody>${filasAlumno.map(a => `
          <tr>
            <td><strong>${a.nombre}</strong></td>
            <td><div class="lineas">${a.clases.map(c => `<span>${c}</span>`).join('')}</div></td>
            <td>${util.fecha(a.inicio)}</td>
            <td>${util.fecha(a.vence)}</td>
            <td><strong>${util.bs(a.total)}</strong></td>
          </tr>`).join('') ||
          '<tr><td colspan="5" class="cargando">Nadie se inscribió con ese filtro en el rango.</td></tr>'}
        </tbody>
      </table>
      <p class="subtexto" style="margin-top:10px">Una fila por alumno. Si lleva varios
        horarios, siguen siendo un inscrito y aquí se suma lo que paga por todos.</p>
    </div>

    <div class="panel">
      <h3>Pases del día · ${f.titulo} (${pases.length})</h3>
      <table>
        <thead><tr><th>Fecha</th><th>Horario</th><th>Monto</th><th>Pago</th><th>Registró</th></tr></thead>
        <tbody>${pases.map(p => `
          <tr><td>${util.fecha(p.fecha)}</td>
              <td>${p.horarios
                    ? `${p.horarios.dias} ${p.horarios.hora_inicio}${
                        p.horarios.instructores?.nombre ? ' · ' + p.horarios.instructores.nombre : ''}`
                    : '<span class="subtexto">Sin horario</span>'}</td>
              <td><strong>${util.bs(p.monto)}</strong></td>
              <td>${p.metodo_pago}</td>
              <td class="subtexto">${p.usuario_nombre || '—'}</td></tr>`).join('') ||
          '<tr><td colspan="5" class="cargando">Sin pases con ese filtro en el rango.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

/** Exporta el reporte generado a un .xlsx real con SheetJS. */
function exportarExcel() {
  if (!repDatos) { notificar('Primero genera el reporte.', true); return; }
  if (repDatos.tipo === 'ventas') return exportarExcelVentas();
  const wb = XLSX.utils.book_new();

  const hojaPagos = XLSX.utils.json_to_sheet(repDatos.pagos.map(p => ({
    Fecha: new Date(p.fecha).toLocaleString('es-BO'),
    Alumno: p.alumnos?.nombre || '',
    Concepto: p.concepto, Método: p.metodo,
    'Monto (Bs.)': Number(p.monto), 'Cobró': p.usuario_nombre || '',
  })));
  XLSX.utils.book_append_sheet(wb, hojaPagos, 'Pagos');

  const hojaIns = XLSX.utils.json_to_sheet(repDatos.inscripciones.map(i => ({
    'N°': i.numero, Fecha: new Date(i.fecha).toLocaleDateString('es-BO'),
    Alumno: i.alumnos?.nombre || '',
    Disciplinas: (i.inscripcion_detalles || []).map(d => d.disciplinas?.nombre).filter(Boolean).join(', '),
    Inicio: i.fecha_inicio, Vence: i.fecha_fin,
    'Total (Bs.)': Number(i.total), 'Método': i.metodo_pago,
  })));
  XLSX.utils.book_append_sheet(wb, hojaIns, 'Inscripciones');

  const hojaPases = XLSX.utils.json_to_sheet(repDatos.pases.map(p => ({
    Fecha: p.fecha,
    Disciplina: p.disciplinas?.nombre || p.horarios?.disciplinas?.nombre || '',
    'Monto (Bs.)': Number(p.monto), Método: p.metodo_pago,
    'Registró': p.usuario_nombre || '',
  })));
  XLSX.utils.book_append_sheet(wb, hojaPases, 'Pases del día');

  const hojaDis = XLSX.utils.json_to_sheet(repDatos.resumen.map(r => ({
    Disciplina: r.nombre, Inscritos: r.inscritos,
    'Mensualidades (Bs.)': r.mensualidades,
    'Pases': r.pases, 'Pases (Bs.)': r.bsPases,
    'Total generado (Bs.)': r.total,
  })));
  XLSX.utils.book_append_sheet(wb, hojaDis, 'Por disciplina');

  const hojaInst = XLSX.utils.json_to_sheet((repDatos.instructores || []).map(r => ({
    Instructor: r.nombre, Alumnos: r.inscritos, 'Clases dictadas': r.clases,
    'Mensualidades (Bs.)': r.mensualidades, Pases: r.pases,
    'Pases (Bs.)': r.bsPases, 'Total generado (Bs.)': r.total,
  })));
  XLSX.utils.book_append_sheet(wb, hojaInst, 'Por instructor');

  const sufijo = repDatos.filtro === 'Todas' ? '' : '_' + repDatos.filtro.replace(/\s+/g, '-');
  XLSX.writeFile(wb, `PrimeFit_Reporte_${repDatos.desde}_a_${repDatos.hasta}${sufijo}.xlsx`);
}

// ============================================================
// REPORTE DE VENTAS DE PRODUCTOS (solo quien puede ver ganancias)
//
// Para el rango elegido responde cuatro preguntas:
//   • ¿Cuánto invertí en mercadería?        → entradas de stock × su costo
//   • ¿Cuánto de esa inversión ya vendí?    → costo de lo vendido
//   • ¿Cuánto gané?                          → lo cobrado − lo que costó
//   • ¿Cuánto de la inversión queda?         → invertido − costo de lo vendido
//
// Además muestra cuánto vale la mercadería que queda en el estante al
// cierre del rango, y cómo se llega de un número al otro.
//
// El stock a una fecha se reconstruye con la bitácora: stock de hoy
// menos todo lo que entró y salió después de esa fecha.
// ============================================================

async function generarReporteVentas() {
  const desde = document.getElementById('repDesde').value;
  const hasta = document.getElementById('repHasta').value;
  const cont = document.getElementById('repResultado');
  if (desde > hasta) { notificar('La fecha "desde" es posterior a la "hasta".', true); return; }
  cont.innerHTML = '<p class="cargando">Generando…</p>';

  const desdeTS = util.desdeISO(desde), hastaTS = util.hastaISO(hasta);

  // La bitácora se pide desde el inicio del rango hasta HOY: lo posterior
  // al rango hace falta para saber cuánto stock había al cerrarlo.
  const pedirMovs = (cols) => db.from('movimientos_stock').select(cols)
    .gte('fecha', desdeTS).order('fecha');

  const [productos, movsR, ventas, promos] = await Promise.all([
    db.from('productos').select('id, codigo, nombre, descripcion, categoria, precio_compra, stock, activo'),
    pedirMovs('producto_id, fecha, tipo, cantidad, costo_unitario, motivo, referencia'),
    db.from('ventas')
      .select('id, numero, fecha, subtotal, descuento, total, costo, ganancia, metodo_pago, usuario_nombre, ' +
              'venta_detalles(producto_id, nombre_producto, descripcion_producto, cantidad, precio_unitario, precio_compra)')
      .eq('anulada', false).gte('fecha', desdeTS).lte('fecha', hastaTS).order('fecha'),
    db.from('promociones').select('costo, promocion_detalles(producto_id, cantidad)')
      .eq('anulada', false).gte('fecha', desdeTS).lte('fecha', hastaTS),
  ]);

  // Si todavía no se ejecutó el paso 21, la columna del costo no existe:
  // se reintenta sin ella y se avisa (las compras se valúan al precio actual).
  let movs = movsR, faltaPaso21 = false;
  if (movsR.error) {
    faltaPaso21 = true;
    movs = await pedirMovs('producto_id, fecha, tipo, cantidad, motivo, referencia');
  }
  for (const r of [productos, movs, ventas, promos]) {
    if (r.error) { cont.innerHTML = `<p class="cargando">${r.error.message}</p>`; return; }
  }

  const listaProd   = productos.data || [];
  const listaMovs   = movs.data || [];
  const listaVentas = ventas.data || [];
  const listaPromos = promos.data || [];
  const prodPorId = new Map(listaProd.map(p => [String(p.id), p]));

  const hastaMs = Date.parse(hastaTS);
  const enRango = (m) => Date.parse(m.fecha) <= hastaMs;   // ya vienen desde "desde"

  // ---------- Una fila por producto ----------
  const filas = new Map();
  const fila = (clave, nombre, descripcion, prod) => {
    if (!filas.has(clave)) filas.set(clave, {
      nombre, descripcion: descripcion || '', codigo: prod?.codigo || '',
      precioCompra: Number(prod?.precio_compra || 0), stockHoy: prod ? Number(prod.stock) : 0,
      existe: !!prod,
      compraU: 0, compraBs: 0, ventaU: 0, ventaBs: 0, costoBs: 0,
      regaloU: 0, movDespues: 0, movDesde: 0,
    });
    return filas.get(clave);
  };
  const filaDeProducto = (id, nombreRespaldo, descRespaldo) => {
    const p = id != null ? prodPorId.get(String(id)) : null;
    return p ? fila('p' + p.id, p.nombre, p.descripcion, p)
             : fila('n' + nombreRespaldo + '|' + (descRespaldo || ''), nombreRespaldo, descRespaldo, null);
  };

  // Todos los productos existen en la tabla, aunque no se muevan
  listaProd.forEach(p => fila('p' + p.id, p.nombre, p.descripcion, p));

  // Bitácora: compras del rango + lo necesario para el stock a cada fecha
  const compras = [];
  listaMovs.forEach(m => {
    const p = prodPorId.get(String(m.producto_id));
    if (!p) return;
    const f = fila('p' + p.id, p.nombre, p.descripcion, p);
    const cant = Number(m.cantidad);
    f.movDesde += cant;                       // todo lo que pasó desde el inicio del rango
    if (!enRango(m)) { f.movDespues += cant; return; }   // pasó después del cierre
    if (m.tipo === 'compra' && cant > 0) {
      const costo = Number(m.costo_unitario ?? p.precio_compra);
      f.compraU += cant;
      f.compraBs += cant * costo;
      compras.push({ fecha: m.fecha, producto: p.nombre, descripcion: p.descripcion || '',
                     cantidad: cant, costo, total: cant * costo, motivo: m.motivo || '' });
    }
  });

  // Ventas del rango, producto por producto
  listaVentas.forEach(v => (v.venta_detalles || []).forEach(d => {
    const f = filaDeProducto(d.producto_id, d.nombre_producto, d.descripcion_producto);
    const cant = Number(d.cantidad);
    f.ventaU  += cant;
    f.ventaBs += cant * Number(d.precio_unitario);
    f.costoBs += cant * Number(d.precio_compra);
  }));

  listaPromos.forEach(r => (r.promocion_detalles || []).forEach(d => {
    const p = prodPorId.get(String(d.producto_id));
    if (p) fila('p' + p.id, p.nombre, p.descripcion, p).regaloU += Number(d.cantidad);
  }));

  // Stock y su valor al abrir y al cerrar el rango
  filas.forEach(f => {
    f.stockFin = f.stockHoy - f.movDespues;
    f.stockIni = f.stockHoy - f.movDesde;
    f.valorFin = f.stockFin * f.precioCompra;
    f.valorIni = f.stockIni * f.precioCompra;
    f.ganancia = f.ventaBs - f.costoBs;
    f.saldo    = f.compraBs - f.costoBs;
  });

  // Solo las filas con algo que contar
  const filasVista = [...filas.values()]
    .filter(f => f.compraU || f.ventaU || f.regaloU || f.stockFin)
    .sort((a, b) => b.ganancia - a.ganancia || b.compraBs - a.compraBs || a.nombre.localeCompare(b.nombre));

  // ---------- Totales ----------
  const suma = (lista, fn) => lista.reduce((s, x) => s + fn(x), 0);
  const T = {
    invertido:   suma(filasVista, f => f.compraBs),
    unidadesCompradas: suma(filasVista, f => f.compraU),
    entradas:    compras.length,
    vendido:     suma(listaVentas, v => Number(v.total)),
    descuentos:  suma(listaVentas, v => Number(v.descuento)),
    costoVendido: suma(listaVentas, v => Number(v.costo)),
    ganancia:    suma(listaVentas, v => Number(v.ganancia)),
    nVentas:     listaVentas.length,
    unidadesVendidas: suma(filasVista, f => f.ventaU),
    regalado:    suma(listaPromos, r => Number(r.costo)),
    valorIni:    suma(filasVista, f => f.valorIni),
    valorFin:    suma(filasVista, f => f.valorFin),
  };
  T.saldo = T.invertido - T.costoVendido;
  // Lo que no se explica con compras, ventas y regalos: mermas, conteos
  // corregidos, devoluciones o cambios en el precio de compra.
  T.ajustes = T.valorFin - (T.valorIni + T.invertido - T.costoVendido - T.regalado);

  repDatos = { tipo: 'ventas', desde, hasta, filtro: 'Ventas',
               filas: filasVista, compras, ventas: listaVentas, totales: T };

  cont.innerHTML = vistaVentas(T, filasVista, compras, desde, hasta, faltaPaso21);
}

function vistaVentas(T, filas, compras, desde, hasta, faltaPaso21) {
  const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;
  const pl = (n, s, p) => `${n} ${n === 1 ? s : (p || s + 's')}`;
  const verde = (n) => `<strong style="color:${n < 0 ? '#ff8a8f' : 'var(--verde)'}">${util.bs(n)}</strong>`;
  const nombreHtml = (f) => `<strong>${f.nombre}</strong>${
    f.descripcion ? ` <span class="subtexto">(${f.descripcion})</span>` : ''}${
    !f.existe ? ' <span class="pill pill-rojo">Eliminado</span>' : ''}`;
  const cierre = hasta === util.hoy() ? 'hoy' : `el ${util.fecha(hasta)}`;

  return `
    ${faltaPaso21 ? `
      <div class="panel"><p class="subtexto" style="margin:0">⚠️ Falta ejecutar
        <strong>supabase/21_reporte_ventas.sql</strong>. Mientras tanto las compras se
        calculan con el precio de compra de hoy y el stock con que se dio de alta cada
        producto no cuenta como inversión.</p></div>` : ''}

    <div class="tarjetas">
      <div class="tarjeta acento"><div class="etiqueta">Invertido en compras</div>
        <div class="valor">${util.bs(T.invertido)}</div>
        <div class="subtexto">${pl(T.unidadesCompradas, 'unidad', 'unidades')} · ${pl(T.entradas, 'entrada')}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Inversión vendida</div>
        <div class="valor">${util.bs(T.costoVendido)}</div>
        <div class="subtexto">lo que costó lo vendido · ${pl(T.unidadesVendidas, 'unidad', 'unidades')}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Vendido (cobrado)</div>
        <div class="valor">${util.bs(T.vendido)}</div>
        <div class="subtexto">${pl(T.nVentas, 'venta')}${T.descuentos > 0 ? ` · ${util.bs(T.descuentos)} en descuentos` : ''}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Ganancia</div>
        <div class="valor" style="color:${T.ganancia < 0 ? '#ff8a8f' : 'var(--verde)'}">${util.bs(T.ganancia)}</div>
        <div class="subtexto">${pct(T.ganancia, T.vendido)}% de lo cobrado</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Saldo de inversión</div>
        <div class="valor">${util.bs(T.saldo)}</div>
        <div class="subtexto">${T.saldo >= 0
          ? 'comprado en el rango que falta vender'
          : 'se vendió mercadería comprada antes del rango'}</div></div>
    </div>

    <div class="panel">
      <h3>Cómo se mueve la inversión</h3>
      <table>
        <thead><tr><th>Concepto</th><th>Monto</th></tr></thead>
        <tbody>
          <tr><td>Invertido en compras</td><td>${util.bs(T.invertido)}</td></tr>
          <tr><td>− Inversión vendida (costo de lo vendido)</td><td>− ${util.bs(T.costoVendido)}</td></tr>
          <tr><td><strong>= Saldo de inversión del rango</strong></td><td><strong>${util.bs(T.saldo)}</strong></td></tr>
          <tr><td colspan="2" style="padding:4px"></td></tr>
          <tr><td>Mercadería en stock al ${util.fecha(desde)} (inicio)</td><td>${util.bs(T.valorIni)}</td></tr>
          <tr><td>+ Saldo de inversión del rango</td><td>${util.bs(T.saldo)}</td></tr>
          ${T.regalado > 0 ? `<tr><td>− Regalado en promociones (costo)</td><td>− ${util.bs(T.regalado)}</td></tr>` : ''}
          ${Math.abs(T.ajustes) >= 0.01 ? `<tr><td>${T.ajustes < 0 ? '−' : '+'} Ajustes de stock
              <span class="subtexto">(mermas, conteos corregidos, cambios de precio de compra)</span></td>
              <td>${T.ajustes < 0 ? '− ' : ''}${util.bs(Math.abs(T.ajustes))}</td></tr>` : ''}
          <tr><td><strong>= Mercadería en stock ${cierre} (cierre)</strong></td><td><strong>${util.bs(T.valorFin)}</strong></td></tr>
        </tbody>
      </table>
      <p class="subtexto" style="margin-top:10px">La mercadería en stock se valúa al
        <strong>precio de compra actual</strong> de cada producto.</p>
    </div>

    <div class="panel">
      <h3>Por producto (${filas.length})</h3>
      <table>
        <thead><tr><th>Producto</th><th>Comprado</th><th>Vendido</th><th>Inversión vendida</th>
                   <th>Ganancia</th><th>Saldo inversión</th><th>Stock al cierre</th></tr></thead>
        <tbody>${filas.map(f => `
          <tr>
            <td>${nombreHtml(f)}</td>
            <td>${f.compraU ? `${f.compraU} u · ${util.bs(f.compraBs)}` : '—'}</td>
            <td>${f.ventaU ? `${f.ventaU} u · ${util.bs(f.ventaBs)}` : '—'}</td>
            <td>${f.ventaU ? util.bs(f.costoBs) : '—'}</td>
            <td>${f.ventaU ? verde(f.ganancia) : '—'}</td>
            <td>${f.compraU || f.ventaU ? util.bs(f.saldo) : '—'}</td>
            <td>${f.existe ? `${f.stockFin} u · ${util.bs(f.valorFin)}` : '—'}${
              f.regaloU ? `<div class="subtexto">${f.regaloU} regalado${f.regaloU === 1 ? '' : 's'}</div>` : ''}</td>
          </tr>`).join('') ||
          '<tr><td colspan="7" class="cargando">Sin compras ni ventas en el rango.</td></tr>'}
          ${filas.length ? `
          ${T.descuentos > 0 ? `
          <tr><td><span class="subtexto">Descuentos aplicados en caja</span></td><td></td>
              <td>− ${util.bs(T.descuentos)}</td><td></td><td>− ${util.bs(T.descuentos)}</td><td></td><td></td></tr>` : ''}
          <tr><td><strong>TOTAL</strong></td>
              <td><strong>${util.bs(T.invertido)}</strong></td>
              <td><strong>${util.bs(T.vendido)}</strong></td>
              <td><strong>${util.bs(T.costoVendido)}</strong></td>
              <td>${verde(T.ganancia)}</td>
              <td><strong>${util.bs(T.saldo)}</strong></td>
              <td><strong>${util.bs(T.valorFin)}</strong></td></tr>` : ''}
        </tbody>
      </table>
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
      <p class="subtexto" style="margin-top:10px">Cada vez que repones con
        <strong>📦 Stock</strong> en Productos queda anotada aquí, con el precio de compra
        que tenía el producto ese día.</p>
    </div>`;
}

/** Excel del reporte de ventas: resumen, por producto, compras y ventas. */
function exportarExcelVentas() {
  const { desde, hasta, filas, compras, ventas, totales: T } = repDatos;
  const wb = XLSX.utils.book_new();
  const r2 = (n) => Math.round(Number(n) * 100) / 100;

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { Concepto: 'Invertido en compras',                'Monto (Bs.)': r2(T.invertido) },
    { Concepto: 'Inversión vendida (costo de lo vendido)', 'Monto (Bs.)': r2(T.costoVendido) },
    { Concepto: 'Vendido (cobrado)',                   'Monto (Bs.)': r2(T.vendido) },
    { Concepto: 'Descuentos aplicados',                'Monto (Bs.)': r2(T.descuentos) },
    { Concepto: 'Ganancia',                            'Monto (Bs.)': r2(T.ganancia) },
    { Concepto: 'Saldo de inversión (invertido − vendido)', 'Monto (Bs.)': r2(T.saldo) },
    { Concepto: 'Mercadería en stock al inicio',      'Monto (Bs.)': r2(T.valorIni) },
    { Concepto: 'Regalado en promociones (costo)',    'Monto (Bs.)': r2(T.regalado) },
    { Concepto: 'Ajustes de stock',                    'Monto (Bs.)': r2(T.ajustes) },
    { Concepto: 'Mercadería en stock al cierre',      'Monto (Bs.)': r2(T.valorFin) },
  ]), 'Resumen');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas.map(f => ({
    Código: f.codigo, Producto: f.nombre, Descripción: f.descripcion,
    'Comprado (u)': f.compraU, 'Invertido (Bs.)': r2(f.compraBs),
    'Vendido (u)': f.ventaU, 'Vendido (Bs.)': r2(f.ventaBs),
    'Inversión vendida (Bs.)': r2(f.costoBs), 'Ganancia (Bs.)': r2(f.ganancia),
    'Saldo inversión (Bs.)': r2(f.saldo),
    'Stock al cierre (u)': f.existe ? f.stockFin : '', 'Stock al cierre (Bs.)': f.existe ? r2(f.valorFin) : '',
    'Regalado (u)': f.regaloU,
  }))), 'Por producto');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compras.map(c => ({
    Fecha: new Date(c.fecha).toLocaleDateString('es-BO'), Producto: c.producto,
    Descripción: c.descripcion, Cantidad: c.cantidad,
    'Costo unitario (Bs.)': r2(c.costo), 'Total (Bs.)': r2(c.total), Motivo: c.motivo,
  }))), 'Compras');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventas.map(v => ({
    'N°': v.numero, Fecha: new Date(v.fecha).toLocaleString('es-BO'),
    Productos: (v.venta_detalles || []).map(d => `${d.cantidad}× ${d.nombre_producto}`).join(', '),
    'Total (Bs.)': r2(v.total), 'Descuento (Bs.)': r2(v.descuento),
    'Costo (Bs.)': r2(v.costo), 'Ganancia (Bs.)': r2(v.ganancia),
    Método: v.metodo_pago, Vendió: v.usuario_nombre || '',
  }))), 'Ventas');

  XLSX.writeFile(wb, `PrimeFit_Ventas_${desde}_a_${hasta}.xlsx`);
}
