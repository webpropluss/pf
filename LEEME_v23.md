# Prime Fit · versión 23

El pase del día pasa de 8 campos a 4, y entra en una pantalla sin deslizar.

> Si todavía no subiste la v22, este paquete la incluye.
> SQL en orden: **16 → 17 → 18 → 19** (los que ya ejecutaste, sáltalos).

---

## Paso 1 · SQL

`supabase/19_pase_simple.sql` en el SQL Editor.
Si sale *"Potential issues detected"* → **Run and enable RLS**.

## Paso 2 · Subir los archivos

```
index.html   app.html   sw.js        (→ v23)
css/estilos.css
js/pases.js
js/usuarios_config.js
supabase/19_pase_simple.sql
```

Confirma que abajo diga **v23**.

---

## Cómo quedó

```
FECHA        [ 05/10/2026 ]
DISCIPLINA   [ — Elegir disciplina — ▾ ]
MONTO        [ Bs. 10 ]  [ Bs. 15 ]  [ Otro ]
PAGO         [ Efectivo ]  [ QR ]

                      [ Cancelar ]  [ Registrar pase ]
```

Se fueron: quién entrena, nombre del visitante, celular, clase/horario y
observación.

El monto son botones, no un campo para escribir: un toque y listo. **Otro**
destapa el campo por si algún día cobras algo distinto.

Los dos montos salen de **Configuración**, así que si mañana cobras 12 y 18 los
cambias ahí sin pedírmelo. Si tenías 25 configurado, pasó a 10 automáticamente.

### La lista

Ahora la primera columna es la **disciplina**, no la persona. Los pases viejos
**no se pierden**: siguen mostrando su visitante debajo de la clase.

---

## Tres decisiones que tomé, por si no coinciden con lo que pensabas

**Dejé la forma de pago** (Efectivo / QR), aunque no la mencionaste. Si la
quitaba, todos los pases quedarían registrados como efectivo, y en Bolivia
mucha gente paga por QR: tus reportes por método de pago dirían cualquier cosa.
Son dos botones en una línea. Si siempre cobras en efectivo, dímelo y la quito.

**La disciplina es obligatoria**, porque la pediste como campo. Si llega alguien
que solo quiere usar las máquinas y no hay una disciplina que le corresponda,
caja se va a trabar. Puedo agregar una opción *"Entrada libre"* — dime si la
necesitas.

**Los visitantes ya no se registran como alumnos.** Antes, cada pase creaba un
alumno con código VIS-. Ahora no se crea nada: no hay nombre que guardar. Los
VIS- que ya existen se quedan en Alumnos, pero esa lista deja de crecer.
Si en algún momento quieres volver a guardar el teléfono de alguien para
invitarlo a sacar mensualidad, eso ahora se hace registrándolo en **Alumnos**.

---

## Lo que se probó

**Base de datos** (cadena 01→19 en PostgreSQL real, el 19 dos veces):

- Un pase sin nombre, con disciplina, se registra bien y su cobro entra a caja
  igual que antes (mismo concepto, ligado al pase, sin alumno).
- Monto 0 se acepta (una cortesía) y no genera cobro; un monto negativo se rechaza.
- Un pase de otro día deja el cobro en **ese** día, no en hoy.
- Eliminar un pase sigue borrando también su cobro.
- Verifiqué que no quedaran dos versiones de la función tras cambiarle la firma.

**En el navegador** (33 comprobaciones, 390 y 320 px):

- El formulario tiene exactamente 4 campos, en el orden que pediste.
- Ya no existen los campos de nombre, teléfono, alumno, horario ni observación.
- El combo trae solo disciplinas: ninguna opción tiene horas.
- Los botones de monto ponen el valor, "Otro" destapa el campo y volver a un
  botón lo corrige.
- Sin disciplina no deja guardar y no manda nada al servidor.
- La lista muestra la disciplina y el pase viejo conserva su visitante.
- A 320 px no desborda nada y los botones miden 48 px de alto.

Las otras 8 suites (v18 a v22) siguen pasando.
