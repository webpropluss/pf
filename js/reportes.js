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

let repDisciplinas = [];   // catálogo, para el filtro

async function cargarReportes(contenido) {
  const hoy = util.hoy();
  const inicioMes = hoy.slice(0, 8) + '01';

  repDisciplinas = verificar(await db.from('disciplinas').select('id, nombre').order('nombre'));

  contenido.innerHTML = `
    <header class="cabecera"><h2>Reportes</h2></header>
    <div class="toolbar">
      <label class="subtexto">Desde</label><input type="date" id="repDesde" value="${inicioMes}">
      <label class="subtexto">Hasta</label><input type="date" id="repHasta" value="${hoy}">
      <select id="repDisciplina" onchange="generarReporte()">
        <option value="">Todas las disciplinas</option>
        ${repDisciplinas.map(d => `<option value="${d.id}">${d.nombre}</option>`).join('')}
      </select>
      <button class="btn btn-rojo" onclick="generarReporte()">Generar</button>
      <button class="btn btn-oscuro" onclick="exportarExcel()">📥 Exportar a Excel</button>
    </div>
    <div id="repResultado"><p class="cargando">Elige el rango de fechas y presiona Generar.</p></div>`;

  generarReporte();
}

let repDatos = null; // guarda el último reporte generado para exportarlo

async function generarReporte() {
  const desde = document.getElementById('repDesde').value;
  const hasta = document.getElementById('repHasta').value;
  const disId = document.getElementById('repDisciplina')?.value || '';
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
      .select('*, alumnos(nombre), inscripcion_detalles(disciplina_id, precio_mensual, precio_lista, meses, disciplinas(nombre))')
      .eq('anulada', false).gte('fecha_inicio', desde).lte('fecha_inicio', hasta),
    db.from('pases_dia')
      .select('*, disciplinas(nombre), horarios(disciplina_id, disciplinas(nombre))')
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

  // ---------- ¿Filtrado por una disciplina? ----------
  const filtrada = disId
    ? { id: disId, nombre: repDisciplinas.find(d => String(d.id) === String(disId))?.nombre || '' }
    : null;

  const insFiltradas = filtrada
    ? listaIns.filter(i => (i.inscripcion_detalles || [])
        .some(d => String(d.disciplina_id) === String(disId)))
    : listaIns;
  const pasesFiltrados = filtrada
    ? listaPases.filter(p => String(disDePase(p)) === String(disId))
    : listaPases;

  repDatos = { desde, hasta, filtro: filtrada?.nombre || 'Todas',
               pagos: listaPagos, inscripciones: insFiltradas,
               pases: pasesFiltrados, resumen: filasResumen };

  cont.innerHTML = filtrada
    ? vistaDisciplina(filtrada, insFiltradas, pasesFiltrados, disId, desde, hasta)
    : vistaGeneral(listaPagos, listaIns, filasResumen, descuentosDados);
}

// ---------------------- VISTA GENERAL ----------------------

function vistaGeneral(pagos, inscripciones, resumen, descuentosDados) {
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
      <p class="subtexto" style="margin-top:10px">Elige una disciplina arriba para ver su detalle.</p>
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

// ---------------------- VISTA DE UNA DISCIPLINA ----------------------

function vistaDisciplina(dis, inscripciones, pases, disId, desde, hasta) {
  // Solo las líneas de ESTA disciplina, no las demás de la misma inscripción
  const lineas = [];
  inscripciones.forEach(i => (i.inscripcion_detalles || [])
    .filter(d => String(d.disciplina_id) === String(disId))
    .forEach(d => lineas.push({ ins: i, det: d })));

  const mensualidades = lineas.reduce((s, l) => s + Number(l.det.precio_mensual) * l.det.meses, 0);

  // Una fila POR ALUMNO, no por línea: si Juan lleva dos horarios de boxeo
  // es un solo inscrito, y la tabla tiene que decir lo mismo que la tarjeta.
  const porAlumno = new Map();
  lineas.forEach(l => {
    const id = l.ins.alumno_id;
    const a = porAlumno.get(id) || {
      nombre: l.ins.alumnos?.nombre || '—',
      inicio: l.ins.fecha_inicio, vence: l.ins.fecha_fin, clases: 0, total: 0,
    };
    a.clases++;
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
      <div class="tarjeta acento"><div class="etiqueta">Inscritos en ${dis.nombre}</div>
        <div class="valor">${inscritos}</div>
        <div class="subtexto">alumnos distintos, sin importar el horario</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Mensualidades</div>
        <div class="valor">${util.bs(mensualidades)}</div>
        <div class="subtexto">${lineas.length} línea${lineas.length === 1 ? '' : 's'} de inscripción</div></div>
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

    <div class="panel">
      <h3>Inscritos en ${dis.nombre} (${inscritos})</h3>
      <table>
        <thead><tr><th>Alumno</th><th>Inicio</th><th>Vence</th>
                   <th>Clases</th><th>Pagó</th></tr></thead>
        <tbody>${filasAlumno.map(a => `
          <tr>
            <td><strong>${a.nombre}</strong></td>
            <td>${util.fecha(a.inicio)}</td>
            <td>${util.fecha(a.vence)}</td>
            <td>${a.clases}${a.clases > 1 ? ' <span class="subtexto">horarios</span>' : ''}</td>
            <td><strong>${util.bs(a.total)}</strong></td>
          </tr>`).join('') ||
          '<tr><td colspan="5" class="cargando">Nadie se inscribió a esta disciplina en el rango.</td></tr>'}
        </tbody>
      </table>
      <p class="subtexto" style="margin-top:10px">Una fila por alumno. Si lleva varios
        horarios de ${dis.nombre}, siguen siendo un inscrito y aquí se suma lo que paga por todos.</p>
    </div>

    <div class="panel">
      <h3>Pases del día de ${dis.nombre} (${pases.length})</h3>
      <table>
        <thead><tr><th>Fecha</th><th>Monto</th><th>Pago</th><th>Registró</th></tr></thead>
        <tbody>${pases.map(p => `
          <tr><td>${util.fecha(p.fecha)}</td>
              <td><strong>${util.bs(p.monto)}</strong></td>
              <td>${p.metodo_pago}</td>
              <td class="subtexto">${p.usuario_nombre || '—'}</td></tr>`).join('') ||
          '<tr><td colspan="4" class="cargando">Sin pases de esta disciplina en el rango.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

/** Exporta el reporte generado a un .xlsx real con SheetJS. */
function exportarExcel() {
  if (!repDatos) { notificar('Primero genera el reporte.', true); return; }
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

  const sufijo = repDatos.filtro === 'Todas' ? '' : '_' + repDatos.filtro.replace(/\s+/g, '-');
  XLSX.writeFile(wb, `PrimeFit_Reporte_${repDatos.desde}_a_${repDatos.hasta}${sufijo}.xlsx`);
}
