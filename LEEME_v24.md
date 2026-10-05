# Prime Fit · versión 24

Filtro por disciplina en **Reportes**.

> Incluye la **v23** (pase del día simplificado), que seguía sin subir.
> El sitio está en v22, así que **sube la carpeta completa**.
> SQL pendiente: **19** (y 16, 17, 18 si alguno no corrió).

---

## Cómo queda

En la barra de Reportes hay un combo nuevo:

```
Desde [ 01/10/2026 ]  Hasta [ 05/10/2026 ]  [ Todas las disciplinas ▾ ]  [Generar]
```

### Con "Todas las disciplinas"

La tabla **Por disciplina** ahora tiene todo junto:

| Disciplina | Inscritos | Mensualidades | Pases | Total generado |
|---|---|---|---|---|
| Boxeo | 2 | Bs. 410.00 | 2 · Bs. 25.00 | **Bs. 435.00** |
| Crossfit | 1 | Bs. 200.00 | 1 · Bs. 10.00 | **Bs. 210.00** |

### Eligiendo una disciplina

Cuatro tarjetas: **inscritos**, **mensualidades**, **pases del día** y **total
generado** en el rango. Más abajo, el detalle de quiénes se inscribieron y la
lista de pases de esa disciplina.

**Los inscritos se cuentan por alumno, no por horario**, que es lo que pediste.
Si Juan lleva dos horarios de boxeo, es **un** inscrito, y en la tabla sale una
sola fila con la suma de lo que paga por los dos.

El Excel también respeta el filtro, y ahora trae una hoja de **Pases del día**.

---

## Dos cambios que vienen con esto

**Reportes ahora cuenta las inscripciones por fecha de inicio**, igual que el
Dashboard. Antes usaba la fecha en que las cargaste al sistema, así que el mismo
rango podía dar números distintos en una pantalla y en la otra. Es el criterio
que elegiste cuando hicimos el filtro del Dashboard; ahora las dos coinciden.

**Arreglé el bug de horario que se me quedó aquí.** En la v22 corregí que la app
usara la hora de Bolivia y no la de Londres, pero me salté `reportes.js`: seguía
pidiendo los pagos con el día corrido 4 horas. Lo encontré ahora al abrir el
archivo. Ya usa el mismo criterio que el resto.

---

## Lo que se probé

**En el navegador** (24 comprobaciones, 390 y 320 px), con un caso armado para
que falle si cuento mal:

- Juan con **dos horarios de boxeo**, María con boxeo + crossfit, Carlos con
  crossfit pero empezando fuera del rango.
- Boxeo → **2 inscritos** (no 3), Bs. 410 de mensualidades, Bs. 25 de pases,
  Bs. 435 en total, Bs. 20 de descuento. La tabla tiene **2 filas**, y la de
  Juan suma sus dos horarios en Bs. 260.
- Crossfit → 1 inscrito (Carlos queda fuera porque el rango arranca el día 1).
- Filtrando boxeo no se cuela nada de crossfit ni aparece Carlos.
- Volver a "Todas" restaura la vista general.
- Verifiqué las consultas que se mandan: los pagos van con el huso horario
  (`-04:00`) y las inscripciones se filtran por `fecha_inicio`.
- A 320 px no desborda nada.

Las otras 9 suites (v18 a v23) siguen pasando.

---

## Una cosa que no hice

No toqué el **Dashboard**. Dijiste primero "en el dashboard" y después "en
reportes", así que lo puse solo en Reportes. Si además quieres el filtro por
disciplina en el Dashboard, dímelo y lo agrego ahí también.
