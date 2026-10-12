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

async function cargarReportes(contenido) {
  const hoy = util.hoy();
  const inicioMes = hoy.slice(0, 8) + '01';

  [repDisciplinas, repInstructores] = await Promise.all([
    db.from('disciplinas').select('id, nombre').order('nombre').then(verificar),
    db.from('instructores').select('id, nombre').order('nombre').then(verificar),
  ]);

  contenido.innerHTML = `
    <header class="cabecera"><h2>Reportes</h2></header>
    <div class="toolbar">
      <label class="subtexto">Desde</label><input type="date" id="repDesde" value="${inicioMes}">
      <label class="subtexto">Hasta</label><input type="date" id="repHasta" value="${hoy}">
      <select id="repDisciplina" onchange="generarReporte()">
        <option value="">Todas las disciplinas</option>
        ${repDisciplinas.map(d => `<option value="${d.id}">${d.nombre}</option>`).join('')}
      </select>
      <select id="repInstructor" onchange="generarReporte()">
        <option value="">Todos los instructores</option>
        ${repInstructores.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('')}
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
  repDatos = { desde, hasta, filtro: titulo || 'Todas',
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
