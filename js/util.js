// ============================================================
// PRIME FIT · Utilidades de formato y fechas
//
// Está en su propio archivo a propósito: el banco de pruebas lo
// carga tal cual, para probar exactamente el mismo código que
// corre en la app (antes tenía una copia y se desincronizaron).
// ============================================================

const util = {
  bs: (n) => 'Bs. ' + Number(n || 0).toFixed(2),
  fecha: (f) => f ? new Date(f + (String(f).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-BO') : '',

  // ---------- FECHAS EN LA HORA DE AQUÍ ----------
  // Antes esto usaba toISOString(), que siempre da la hora de Londres (UTC).
  // En Bolivia (UTC−4) eso significaba que a partir de las 20:00 la app ya
  // creía que era el día siguiente: una venta de las 21:00 se anotaba mañana
  // y el Dashboard "Hoy" no la mostraba. Un gimnasio abre de noche, así que
  // todo lo que sea "qué día es" pasa por aquí.

  /** La fecha (AAAA-MM-DD) de un momento, en la hora local. */
  diaLocal: (f) => new Date(f.getTime() - f.getTimezoneOffset() * 60000)
                     .toISOString().slice(0, 10),

  /** Hoy, según el reloj del gimnasio. */
  hoy: () => util.diaLocal(new Date()),

  /** Pasa a día local lo que venga: un instante de la base o una fecha suelta. */
  dia: (v) => {
    if (!v) return '';
    const s = String(v);
    return s.length === 10 ? s : util.diaLocal(new Date(s));
  },

  /** El mes (AAAA-MM) de lo que venga, en hora local. */
  mes: (v) => util.dia(v).slice(0, 7),

  /** Desfase horario en formato ISO, ej. "-04:00". */
  huso: () => {
    const m = -new Date().getTimezoneOffset();
    const a = Math.abs(m);
    return (m >= 0 ? '+' : '-') +
      String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0');
  },

  // Límites de un día para consultar a la base. Llevan el desfase horario:
  // sin él, Supabase los entendería como hora de Londres y el día quedaría
  // corrido 4 horas.
  desdeISO: (dia) => dia + 'T00:00:00' + util.huso(),
  hastaISO: (dia) => dia + 'T23:59:59.999' + util.huso(),
};
