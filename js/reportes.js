// ============================================================
// PRIME FIT · Módulo Reportes (con exportación real a Excel)
// ============================================================

async function cargarReportes(contenido) {
  const hoy = util.hoy();
  const inicioMes = hoy.slice(0, 8) + '01';

  contenido.innerHTML = `
    <header class="cabecera"><h2>Reportes</h2></header>
    <div class="toolbar">
      <label class="subtexto">Desde</label><input type="date" id="repDesde" value="${inicioMes}">
      <label class="subtexto">Hasta</label><input type="date" id="repHasta" value="${hoy}">
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
  const cont = document.getElementById('repResultado');
  cont.innerHTML = '<p class="cargando">Generando…</p>';

  const [pagos, inscripciones] = await Promise.all([
    db.from('pagos').select('*, alumnos(nombre)')
      .gte('fecha', desde + 'T00:00:00').lte('fecha', hasta + 'T23:59:59').order('fecha'),
    db.from('inscripciones')
      .select('*, alumnos(nombre), inscripcion_detalles(precio_mensual, precio_lista, meses, disciplinas(nombre))')
      .eq('anulada', false)
      .gte('fecha', desde + 'T00:00:00').lte('fecha', hasta + 'T23:59:59'),
  ]);

  const totalCobrado = (pagos.data || []).reduce((s, p) => s + Number(p.monto), 0);
  const totalFacturado = (inscripciones.data || []).reduce((s, i) => s + Number(i.total), 0);

  // Ingresos facturados por disciplina + descuentos otorgados (precio especial)
  const porDisciplina = {};
  let descuentosDados = 0;
  (inscripciones.data || []).forEach(i =>
    (i.inscripcion_detalles || []).forEach(d => {
      const nom = d.disciplinas?.nombre || '—';
      const cobrado = Number(d.precio_mensual);
      const lista = Number(d.precio_lista ?? d.precio_mensual);
      porDisciplina[nom] = (porDisciplina[nom] || 0) + cobrado * d.meses;
      descuentosDados += Math.max(lista - cobrado, 0) * d.meses;
    }));

  repDatos = { desde, hasta, pagos: pagos.data || [], inscripciones: inscripciones.data || [], porDisciplina };

  cont.innerHTML = `
    <div class="tarjetas">
      <div class="tarjeta acento"><div class="etiqueta">Cobrado en el rango</div><div class="valor">${util.bs(totalCobrado)}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Facturado (inscripciones)</div><div class="valor">${util.bs(totalFacturado)}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Inscripciones</div><div class="valor">${(inscripciones.data || []).length}</div></div>
      <div class="tarjeta acento"><div class="etiqueta">Descuentos otorgados</div><div class="valor">${util.bs(descuentosDados)}</div></div>
    </div>

    <div class="panel">
      <h3>Ingresos por disciplina (facturado)</h3>
      <table>
        <thead><tr><th>Disciplina</th><th>Monto</th></tr></thead>
        <tbody>${Object.entries(porDisciplina).map(([n, m]) =>
          `<tr><td>${n}</td><td><strong>${util.bs(m)}</strong></td></tr>`).join('') ||
          '<tr><td colspan="2" class="cargando">Sin datos en el rango.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="panel">
      <h3>Pagos del rango (${(pagos.data || []).length})</h3>
      <table>
        <thead><tr><th>Fecha</th><th>Alumno</th><th>Concepto</th><th>Método</th><th>Monto</th></tr></thead>
        <tbody>${(pagos.data || []).map(p => `
          <tr><td>${new Date(p.fecha).toLocaleString('es-BO')}</td>
              <td>${p.alumnos?.nombre || '—'}</td><td>${p.concepto}</td>
              <td>${p.metodo}</td><td>${util.bs(p.monto)}</td></tr>`).join('') ||
          '<tr><td colspan="5" class="cargando">Sin pagos en el rango.</td></tr>'}
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
    Inicio: i.fecha_inicio, Vence: i.fecha_fin,
    'Total (Bs.)': Number(i.total), 'Método': i.metodo_pago,
  })));
  XLSX.utils.book_append_sheet(wb, hojaIns, 'Inscripciones');

  const hojaDis = XLSX.utils.json_to_sheet(Object.entries(repDatos.porDisciplina)
    .map(([n, m]) => ({ Disciplina: n, 'Facturado (Bs.)': m })));
  XLSX.utils.book_append_sheet(wb, hojaDis, 'Por disciplina');

  XLSX.writeFile(wb, `PrimeFit_Reporte_${repDatos.desde}_a_${repDatos.hasta}.xlsx`);
}
