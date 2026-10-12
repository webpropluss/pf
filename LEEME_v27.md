# Prime Fit · versión 27

El pase del día vuelve a guardar su horario, y con él, su instructor. La
cantidad se queda.

---

## ⚠ Primero: el SQL

Ejecuta **`supabase/20_pase_con_horario.sql`**.

**No ejecutes el 19.** Este 20 hace todo lo del 19 y más, así que si nunca
corriste el 19, sáltatelo. Y si ya lo corriste, corre el 20 igual: lo completa.
Lo probé desde los dos puntos de partida.

Después, sube la carpeta completa. Debe decir **v27** abajo.

---

## Cómo quedó el pase del día

```
FECHA            [ 11/10/2026 ]
DISCIPLINA       [ Híbrido ▾ ]
HORARIO          [ Ma-Ju 20:00 · Lucía ▾ ]
MONTO            [ Bs. 10 ]  [ Bs. 15 ]  [ Otro ]
PAGO             [ Efectivo ]  [ QR ]
¿CUÁNTOS PASES?  [ 5 ]

                        [ Cancelar ]  [ Registrar Bs. 75.00 ]
```

El combo de horario **solo muestra los de la disciplina elegida**, y cada uno
dice qué instructor lo da. Si cambias de disciplina, se vacía y se vuelve a
llenar: nunca te deja un horario que no corresponde.

Si una disciplina no tiene horarios cargados, no te bloquea: se puede guardar
sin horario, avisándote que entonces ese pase no se le podrá atribuir a nadie.

**La cantidad sigue igual de clara:** 5 pases de Bs. 15 son cinco registros
independientes, no uno de Bs. 75. El botón te dice el total antes de tocarlo.

## Los pases ya cuentan para el instructor

Esto era la limitación que te mencioné, y ya no está:

- Al filtrar Reportes por **Lucía**, sus pases del día suman en su tarjeta y en
  el *total generado*.
- La tabla **Por instructor** de la vista general ahora tiene: alumnos,
  mensualidades, pases y total generado.
- La lista de Pases del día y el reporte muestran el horario y el instructor
  de cada uno.

**Los pases que ya registraste sin horario** no se le pueden atribuir a nadie —
no hay de dónde sacar el dato. Aparecen como *"Sin instructor"* en la tabla
general, y cuando filtras por un instructor el reporte te dice cuántos quedaron
fuera, en vez de hacer como si no existieran.

---

## Un cambio por debajo

La cantidad **la resuelve ahora la base de datos en una sola operación**, no la
app mandando uno por uno. Antes lo hice así para ahorrarte un SQL; como ahora
hay que tocar la base igual por el horario, lo dejé bien: los 5 pases entran
todos o no entra ninguno, y ya no existe el caso de "quedaron 3 de 5" si se
corta el internet.

La función además **rechaza un horario que no sea de la disciplina elegida**,
para que no se le acredite a un instructor una clase que no dio.

---

## Lo que se probé

**Base de datos** (PostgreSQL real), el paso 20 desde los dos escenarios —base
que nunca corrió el 19 y base que sí— y dos veces seguidas en cada uno:

- 5 pases de Zumba a Bs. 15 → **5 registros de 15**, total Bs. 75, cada uno con
  su cobro, todos el día que se indicó, todos atribuidos a Lucía.
- Un horario de otra disciplina se rechaza y **no queda nada a medias**.
- Cantidad 0 o 99 se rechazan; sin horario se acepta (entrada libre).
- Queda una sola versión de la función, no tres.

**En el navegador** (24 comprobaciones, 390 y 320 px):

- El combo de horario se filtra por disciplina y se limpia al cambiarla.
- Con horarios disponibles es obligatorio; sin ellos, deja guardar y avisa.
- Pide 5 pases en **una sola llamada**, con monto 15 y el horario de Lucía.
- En Reportes, Lucía suma Bs. 30 de pases y Marco Bs. 10; el pase viejo sin
  horario sale como "Sin instructor" y el filtro avisa que queda fuera.
- El formulario de 6 campos no desborda a 320 px.

Las otras 12 suites siguen pasando.
