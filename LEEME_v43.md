# Prime Fit · versión 43 · corrección de pagos

**No hay SQL nuevo.** Solo subir la carpeta. Abajo del menú debe decir **v43**
(si no, recarga con Ctrl + F5).

Está hecha sobre la **v39** y **no incluye el módulo de Sorteos** (v40–v42), que
quedó descartado: los talonarios se hacen a mano.

## Qué pasaba

Inscripciones recién cobradas salían **"Pendiente"** con **Pagado Bs. 0,00**,
aunque el cobro sí estaba guardado.

**Causa:** Supabase entrega como máximo **1.000 filas** por consulta y corta el
resto sin avisar. Para calcular cuánto pagó cada inscripción, el sistema pedía
**todos los pagos del gimnasio**: inscripciones, pases del día y ventas. Con los
meses pasaron de 1.000, y los más nuevos quedaban afuera de la cuenta.

**No se perdió ningún dato:** los cobros siempre estuvieron guardados. Solo no se
estaban sumando en la pantalla.

## Qué se corrigió

Las consultas que podían pasar de 1.000 filas ahora traen los datos en tandas,
hasta tenerlos todos:

- **Inscripciones:** columnas Pagado, Saldo y Estado.
- **Pagos:** saldo de cada inscripción.
- **Dashboard:** "Pagos pendientes" e ingresos del período.
- **Reportes, Reporte de ventas y Pago a instructores:** rangos de fechas largos.

Si después de actualizar alguna inscripción sigue saliendo "Pendiente", ahí sí
falta registrar el pago (en **Pagos**).
