# Prime Fit · versión 22

Arregla el error al agregar instructor. Y, buscándolo, apareció **otro bug peor**
que te está afectando ahora mismo: a partir de las 20:00 la app creía que ya
era el día siguiente.

> Incluye todo lo de la **v20** y la **v21**, que no habías subido.
> Ejecuta los SQL en orden: **16 → 17 → 18**.

---

## Paso 1 · SQL en Supabase, en este orden

1. `supabase/16_fecha_cobro.sql`
2. `supabase/17_promociones.sql`
3. `supabase/18_codigos_sin_choque.sql`

Si sale *"Potential issues detected"* → **Run and enable RLS**.

## Paso 2 · Subir todo

Esta vez cambió bastante, así que lo más simple es subir la carpeta completa.
Confirma que abajo diga **v22**.

---

## 1 · El error que te salió

```
duplicate key value violates unique constraint "instructores_codigo_key"
```

El código nuevo se calculaba **contando las filas**: si había 2 instructores,
el siguiente era el INS-003. Eso funciona solo mientras nunca borres nada.

Como después agregamos poder eliminar instructores, la cuenta dejó de coincidir
con los códigos que de verdad existen:

| Existen | Filas | Proponía | Resultado |
|---|---|---|---|
| INS-002, INS-003 | 2 | INS-**003** | ya existe → error |

Ahora mira el número **más alto** que ya existe y le suma uno: propone INS-004.
Con huecos de por medio funciona igual.

Afectaba a lo mismo en **alumnos (ALU)**, **visitantes (VIS)**, **disciplinas
(DIS)** y **productos (PRO)**: a todos les iba a pasar lo mismo apenas
borraras uno.

También agregué un reintento: si dos cajas guardan en el mismo segundo y toman
el mismo número, el segundo lo vuelve a intentar con el siguiente en vez de
mostrarte ese error.

---

## 2 · El bug que encontré de paso (este importa más)

Me escribiste 21:20. A esa hora la app **creía que ya era 1 de octubre**.

La causa: para saber qué día es usaba la hora de Londres (UTC). Bolivia está
4 horas atrás, así que **todos los días, desde las 20:00**, la app se adelantaba
un día. Lo que eso provocaba:

- Una venta de las 21:00 se anotaba **mañana**.
- El Dashboard en **"Hoy"** no mostraba la plata de la noche: justo las horas
  de más movimiento de un gimnasio.
- El cierre de mes partía mal: lo del 30 a las 21:00 caía en el mes siguiente.
- Al inscribir, la fecha de inicio venía con la de mañana.

Ya está corregido en todo: dashboard, ventas, pagos, pases, promociones e
inscripciones usan la hora del gimnasio. Las consultas a Supabase además mandan
el huso horario, para que el día vaya de medianoche a medianoche **de aquí** y
no corrido 4 horas.

**No hace falta corregir nada de lo ya cargado**: la base siempre guardó el
momento exacto, lo que estaba mal era cómo se leía. Lo viejo se reacomoda solo.

---

## 3 · Un cambio interno

`util` (formatos y fechas) salió de `app.js` a **`js/util.js`**. Mi banco de
pruebas tenía una copia pegada de ese código y se desincronizó: estuve probando
una versión vieja sin darme cuenta. Ahora hay un solo archivo y las pruebas
usan exactamente el mismo que la app.

---

## Lo que se probó

**Base de datos** (cadena 01→18 en PostgreSQL real):

- Reproduje tu caso exacto: con INS-002 e INS-003, el método viejo proponía
  INS-003 (que choca) y el nuevo propone INS-004 (libre). El insert pasa.
- Borrar el último, la tabla vacía (vuelve a 001) y los huecos en el medio.
- ALU y VIS conviven en la misma tabla con numeración independiente.
- La función rechaza tablas y prefijos raros, porque arma SQL al vuelo;
  probé con un intento de inyección y lo rechaza sin tocar los datos.

**Horario** (reloj congelado a las 21:20 del 30/9, en zona de Bolivia):

- `util.hoy()` da 30/9, no 1/10.
- Un cobro de las 21:00 aparece en el Dashboard "Hoy"; el del día siguiente no.
- Los límites que se mandan a la base son `00:00:00-04:00` a `23:59:59-04:00`,
  que es medianoche a medianoche de aquí.
- Ventas y la inscripción proponen la fecha correcta.

**Navegador**: 8 suites, todas pasando, incluidas las de v18 a v21.

---

### Dos cosas que debo decirte

**Estos dos bugs los metí yo.** El de los códigos lo creé cuando agregamos poder
eliminar (v8/v9) y no revisé que el generador aguantara huecos. El del horario
venía desde el principio.

**Y casi se me escapan por una prueba mal hecha.** Tres suites fallaron después
del arreglo y mi primer impulso fue darlas por "frágiles por el cambio de mes".
Al revisarlas una por una, dos sí lo eran, pero el tercer fallo era real y
destapó lo del horario. Por eso ahora el banco de pruebas compara las fechas
como instantes y usa la hora local, igual que la app: como estaba, no habría
detectado nunca este problema.
