// ============================================================
// PRIME FIT · Pago a instructores (solo administrador)
//
// Cada instructor se lleva su porcentaje (módulo Instructores) de lo
// que se COBRÓ en el rango por sus clases:
//   • Inscripciones: el cobro se reparte entre las clases de esa
//     inscripción según lo que vale cada una. Si Juan paga Bs. 300 por
//     Boxeo (Bs. 150, con Marco) y Zumba (Bs. 150, con Lucía), a cada
//     uno se le atribuyen Bs. 150. Un pago a cuenta se reparte igual.
//   • Pases del día: van al instructor del horario del pase. Los pases
//     sin horario no tienen instructor y quedan enteros para Prime Fit.
//
// Se cuenta por la FECHA DEL COBRO, igual que "Ingresos" del Dashboard,
// para que el ingreso neto del Dashboard y este reporte digan lo mismo.
// ============================================================

/**
 * Calcula lo que le toca a cada instructor entre dos fechas (AAAA-MM-DD).
 * La usa también el Dashboard.
 */
async function calcularPagoInstructores(desde, hasta) {
  const [insR, pagosR] = await Promise.all([
    db.from('instructores').select('id, nombre, porcentaje, activo'),
    db.from('pagos').select('id, fecha, monto, metodo, inscripcion_id, pase_dia_id, alumnos(nombre)')
      .gte('fecha', util.desdeISO(desde)).lte('fecha', util.hastaISO(hasta)).order('fecha'),
  ]);

  // Sin el paso 22 no existe la columna: todos quedan en 0 % y se avisa
  let instructores = insR, faltaPaso22 = false;
  if (insR.error) {
    faltaPaso22 = true;
    instructores = await db.from('instructores').select('id, nombre, activo');
  }
  if (instructores.error) throw new Error(instructores.error.message);
  if (pagosR.error) throw new Error(pagosR.error.message);

  const pagos = pagosR.data || [];
  const idsIns   = [...new Set(pagos.filter(p => p.inscripcion_id).map(p => p.inscripcion_id))];
  const idsPases = [...new Set(pagos.filter(p => p.pase_dia_id).map(p => p.pase_dia_id))];

  const [detR, pasesR] = await Promise.all([
    idsIns.length
      ? db.from('inscripcion_detalles')
          .select('inscripcion_id, precio_mensual, meses, disciplinas(nombre), ' +
                  'horarios(dias, hora_inicio, instructor_id)')
          .in('inscripcion_id', idsIns)
      : { data: [] },
    idsPases.length
      ? db.from('pases_dia')
          .select('id, disciplinas(nombre), horarios(dias, hora_inicio, instructor_id, disciplinas(nombre))')
          .in('id', idsPases)
      : { data: [] },
  ]);
  if (detR.error) throw new Error(detR.error.message);
  if (pasesR.error) throw new Error(pasesR.error.message);

  const lineasDe = {};
  (detR.data || []).forEach(d => (lineasDe[d.inscripcion_id] = lineasDe[d.inscripcion_id] || []).push(d));
  const paseDe = {};
  (pasesR.data || []).forEach(p => paseDe[p.id] = p);

  // Una "caja" por instructor; null = sin instructor (todo para Prime Fit)
  const cajas = new Map();
  (instructores.data || []).forEach(i => cajas.set(String(i.id), {
    id: i.id, nombre: i.nombre, activo: i.activo,
    porcentaje: Number(i.porcentaje || 0),
    cobradoIns: 0, cobradoPases: 0, alumnos: new Set(), nPases: 0, detalle: [],
  }));
  const sinInstructor = { cobradoIns: 0, cobradoPases: 0, nPases: 0, detalle: [] };
  const cajaDe = (id) => (id != null && cajas.get(String(id))) || null;

  const clase = (dis, h) => [dis, h ? `${h.dias} ${h.hora_inicio}` : ''].filter(Boolean).join(' · ');

  pagos.forEach(p => {
    const monto = Number(p.monto);
    if (p.inscripcion_id) {
      const lineas = lineasDe[p.inscripcion_id] || [];
      const pesos = lineas.map(l => Number(l.precio_mensual) * Number(l.meses || 1));
      const total = pesos.reduce((s, x) => s + x, 0);
      if (!lineas.length) {           // inscripción sin clases (no debería pasar)
        sinInstructor.cobradoIns += monto;
        sinInstructor.detalle.push({ fecha: p.fecha, quien: p.alumnos?.nombre || '—',
          tipo: 'Inscripción', clase: '—', monto });
        return;
      }
      lineas.forEach((l, k) => {
        const parte = total > 0 ? monto * pesos[k] / total : monto / lineas.length;
        const c = cajaDe(l.horarios?.instructor_id);
        const fila = { fecha: p.fecha, quien: p.alumnos?.nombre || '—', tipo: 'Inscripción',
                       clase: clase(l.disciplinas?.nombre, l.horarios), monto: parte };
        if (c) { c.cobradoIns += parte; c.alumnos.add(p.alumnos?.nombre || p.inscripcion_id); c.detalle.push(fila); }
        else   { sinInstructor.cobradoIns += parte; sinInstructor.detalle.push(fila); }
      });
    } else if (p.pase_dia_id) {
      const pase = paseDe[p.pase_dia_id];
      const c = cajaDe(pase?.horarios?.instructor_id);
      const fila = { fecha: p.fecha, quien: 'Pase del día', tipo: 'Pase',
        clase: clase(pase?.disciplinas?.nombre || pase?.horarios?.disciplinas?.nombre, pase?.horarios), monto };
      if (c) { c.cobradoPases += monto; c.nPases++; c.detalle.push(fila); }
      else   { sinInstructor.cobradoPases += monto; sinInstructor.nPases++; sinInstructor.detalle.push(fila); }
    }
    // los cobros de ventas no se reparten con instructores
  });

  const filas = [...cajas.values()]
    .map(c => {
      const base = c.cobradoIns + c.cobradoPases;
      const pago = base * c.porcentaje / 100;
      return { ...c, inscritos: c.alumnos.size, base, pago, gimnasio: base - pago };
    })
    .filter(f => f.base > 0 || f.activo)
    .sort((a, b) => b.pago - a.pago || b.base - a.base || a.nombre.localeCompare(b.nombre));

  const baseSin = sinInstructor.cobradoIns + sinInstructor.cobradoPases;
  const totalBase = filas.reduce((s, f) => s + f.base, 0) + baseSin;
  const totalPago = filas.reduce((s, f) => s + f.pago, 0);

  return { filas, sinInstructor: { ...sinInstructor, base: baseSin },
           totalBase, totalPago, totalGimnasio: totalBase - totalPago, faltaPaso22 };
}

// ---------------------- PANTALLA ----------------------

let piDatos = null;

async function cargarPagoInstructores(contenido) {
  const hoy = util.hoy();
  contenido.innerHTML = `
    <header class="cabecera"><h2>Pago a instructores</h2></header>
    <div class="toolbar">
      <label class="subtexto">Desde</label><input type="date" id="piDesde" value="${hoy.slice(0, 8)}01">
      <label class="subtexto">Hasta</label><input type="date" id="piHasta" value="${hoy}">
      <button class="btn btn-rojo" onclick="generarPagoInstructores()">Generar</button>
      <button class="btn btn-oscuro" onclick="exportarPagoInstructores()">📥 Exportar a Excel</button>
    </div>
    <div id="piResultado"><p class="cargando">Generando…</p></div>`;
  generarPagoInstructores();
}

async function generarPagoInstructores() {
  const desde = document.getElementById('piDesde').value;
  const hasta = document.getElementById('piHasta').value;
  const cont = document.getElementById('piResultado');
  if (!desde || !hasta) { notificar('Elige las dos fechas.', true); return; }
  if (desde > hasta) { notificar('La fecha "desde" es posterior a la "hasta".', true); return; }
  cont.innerHTML = '<p class="cargando">Generando…</p>';

  let R;
  try { R = await calcularPagoInstructores(desde, hasta); }
  catch (e) { cont.innerHTML = `<p class="cargando">${e.message}</p>`; return; }
  piDatos = { desde, hasta, ...R };

  const sinPct = R.filas.filter(f => f.base > 0 && !f.porcentaje);
  const S = R.sinInstructor;
  const fecha = (f) => new Date(f).toLocaleDateString('es-BO');

  cont.innerHTML = `
    ${R.faltaPaso22 ? `
      <div class="panel"><p class="subtexto" style="margin:0">⚠️ Falta ejecutar
        <strong>supabase/22_porcentaje_instructores.sql</strong>. Hasta entonces todos los
        instructores figuran con 0 %.</p></div>` : ''}

    <div class="tarjetas">
      <div class="tarjeta acento"><div class="etiqueta">Cobrado por clases</div>
        <div class="valor">${util.bs(R.totalBase)}</div>
        <div class="subtexto">inscripciones y pases del día</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Pago a instructores</div>
        <div class="valor">${util.bs(R.totalPago)}</div>
        <div class="subtexto">${R.filas.filter(f => f.pago > 0).length} instructor(es) a pagar</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Queda para Prime Fit</div>
        <div class="valor" style="color:var(--verde)">${util.bs(R.totalGimnasio)}</div>
        <div class="subtexto">${R.totalBase > 0 ? Math.round(R.totalGimnasio / R.totalBase * 100) : 0}% de lo cobrado</div></div>
    </div>

    ${sinPct.length ? `
      <div class="panel"><p class="subtexto" style="margin:0">⚠️ <strong>${sinPct.map(f => f.nombre).join(', ')}</strong>
        ${sinPct.length === 1 ? 'tiene' : 'tienen'} cobros pero no ${sinPct.length === 1 ? 'tiene' : 'tienen'}
        porcentaje: figura${sinPct.length === 1 ? '' : 'n'} con Bs. 0. Ponlo en
        <strong>Instructores → ✏️ Editar</strong>.</p></div>` : ''}

    <div class="panel">
      <h3>Liquidación · ${util.fecha(desde)} → ${util.fecha(hasta)}</h3>
      <table>
        <thead><tr><th>Instructor</th><th>Porcentaje</th><th>Inscripciones</th><th>Pases</th>
                   <th>Total cobrado</th><th>Le corresponde</th><th>Prime Fit</th></tr></thead>
        <tbody>${R.filas.map(f => `
          <tr>
            <td><strong>${f.nombre}</strong>${!f.activo ? ' <span class="pill pill-rojo">Inactivo</span>' : ''}</td>
            <td>${f.porcentaje ? `${f.porcentaje}%` : '<span class="pill pill-amarillo">Sin definir</span>'}</td>
            <td>${f.cobradoIns ? `${util.bs(f.cobradoIns)}<div class="subtexto">${f.inscritos} alumno${f.inscritos === 1 ? '' : 's'}</div>` : '—'}</td>
            <td>${f.nPases ? `${util.bs(f.cobradoPases)}<div class="subtexto">${f.nPases} pase${f.nPases === 1 ? '' : 's'}</div>` : '—'}</td>
            <td>${util.bs(f.base)}</td>
            <td><strong>${util.bs(f.pago)}</strong></td>
            <td style="color:var(--verde)">${util.bs(f.gimnasio)}</td>
          </tr>`).join('') || '<tr><td colspan="7" class="cargando">No hay instructores.</td></tr>'}
          ${S.base > 0 ? `
          <tr>
            <td><span class="subtexto">Sin instructor</span></td><td>—</td>
            <td>${S.cobradoIns ? util.bs(S.cobradoIns) : '—'}</td>
            <td>${S.nPases ? `${util.bs(S.cobradoPases)}<div class="subtexto">${S.nPases} pase${S.nPases === 1 ? '' : 's'}</div>` : '—'}</td>
            <td>${util.bs(S.base)}</td><td>${util.bs(0)}</td>
            <td style="color:var(--verde)">${util.bs(S.base)}</td>
          </tr>` : ''}
          <tr class="fila-total"><td><strong>TOTAL</strong></td><td></td><td></td><td></td>
            <td><strong>${util.bs(R.totalBase)}</strong></td>
            <td><strong>${util.bs(R.totalPago)}</strong></td>
            <td><strong style="color:var(--verde)">${util.bs(R.totalGimnasio)}</strong></td></tr>
        </tbody>
      </table>
      <p class="subtexto" style="margin-top:10px">Se cuenta lo <strong>cobrado</strong> en el rango
        (por la fecha del pago). Si una inscripción tiene clases con distintos instructores, el cobro
        se reparte según lo que vale cada clase. Los pases sin horario no tienen instructor.
        Se usa el porcentaje que tiene hoy cada instructor.</p>
    </div>

    ${[...R.filas.filter(f => f.detalle.length),
       ...(S.detalle.length ? [{ nombre: 'Sin instructor', porcentaje: 0, detalle: S.detalle, pago: 0 }] : [])]
      .map(f => `
      <details class="panel detalle-instructor">
        <summary><strong>${f.nombre}</strong> · ${f.detalle.length} cobro${f.detalle.length === 1 ? '' : 's'}
          · le corresponde ${util.bs(f.pago)}</summary>
        <table>
          <thead><tr><th>Fecha</th><th>Alumno</th><th>Clase</th><th>Cobrado</th><th>Instructor (${f.porcentaje}%)</th></tr></thead>
          <tbody>${f.detalle.map(d => `
            <tr><td>${fecha(d.fecha)}</td><td>${d.quien}</td><td class="subtexto">${d.clase || '—'}</td>
                <td>${util.bs(d.monto)}</td><td><strong>${util.bs(d.monto * f.porcentaje / 100)}</strong></td></tr>`).join('')}
          </tbody>
        </table>
      </details>`).join('')}`;
}

function exportarPagoInstructores() {
  if (!piDatos) { notificar('Primero genera el reporte.', true); return; }
  const { desde, hasta, filas, sinInstructor: S, totalBase, totalPago, totalGimnasio } = piDatos;
  const r2 = (n) => Math.round(Number(n) * 100) / 100;
  const wb = XLSX.utils.book_new();

  const resumen = filas.map(f => ({
    Instructor: f.nombre, 'Porcentaje (%)': f.porcentaje,
    'Inscripciones (Bs.)': r2(f.cobradoIns), Alumnos: f.inscritos,
    'Pases (Bs.)': r2(f.cobradoPases), Pases: f.nPases,
    'Total cobrado (Bs.)': r2(f.base), 'Le corresponde (Bs.)': r2(f.pago), 'Prime Fit (Bs.)': r2(f.gimnasio),
  }));
  if (S.base > 0) resumen.push({ Instructor: 'Sin instructor', 'Porcentaje (%)': 0,
    'Inscripciones (Bs.)': r2(S.cobradoIns), 'Pases (Bs.)': r2(S.cobradoPases), Pases: S.nPases,
    'Total cobrado (Bs.)': r2(S.base), 'Le corresponde (Bs.)': 0, 'Prime Fit (Bs.)': r2(S.base) });
  resumen.push({ Instructor: 'TOTAL', 'Total cobrado (Bs.)': r2(totalBase),
    'Le corresponde (Bs.)': r2(totalPago), 'Prime Fit (Bs.)': r2(totalGimnasio) });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Liquidación');

  const detalle = [];
  filas.forEach(f => f.detalle.forEach(d => detalle.push({
    Instructor: f.nombre, Fecha: new Date(d.fecha).toLocaleDateString('es-BO'), Tipo: d.tipo,
    Alumno: d.quien, Clase: d.clase, 'Cobrado (Bs.)': r2(d.monto),
    'Porcentaje (%)': f.porcentaje, 'Instructor (Bs.)': r2(d.monto * f.porcentaje / 100),
  })));
  S.detalle.forEach(d => detalle.push({ Instructor: 'Sin instructor',
    Fecha: new Date(d.fecha).toLocaleDateString('es-BO'), Tipo: d.tipo, Alumno: d.quien,
    Clase: d.clase, 'Cobrado (Bs.)': r2(d.monto), 'Porcentaje (%)': 0, 'Instructor (Bs.)': 0 }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'Detalle');

  XLSX.writeFile(wb, `PrimeFit_PagoInstructores_${desde}_a_${hasta}.xlsx`);
}
