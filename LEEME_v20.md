# Prime Fit · versión 20

El dashboard ahora se filtra por fecha, y el dinero se anota en el día que
realmente entró — no en el día que lo cargaste al sistema.

---

## Paso 1 · Ejecutar el SQL

Supabase → **SQL Editor** → pega `supabase/16_fecha_cobro.sql` → **Run**.
Si aparece *"Potential issues detected"*, presiona **Run and enable RLS**.

Ese script hace dos cosas, y la segunda es opcional:

1. La inscripción ahora puede decir **en qué día entró el dinero**.
2. Al final trae una consulta que te **muestra** las inscripciones que ya
   cargaste con el cobro en un día distinto al de inicio — como las de Guzmán y
   Carla. **Solo las muestra, no cambia nada.** Si la lista es la que esperabas y
   quieres corregirlas, el propio archivo te dice qué tres líneas destapar.

## Paso 2 · Subir los archivos

```
index.html   app.html   sw.js        (v19 → v20)
css/estilos.css
js/dashboard.js
js/inscripciones.js
supabase/16_fecha_cobro.sql          (nuevo)
```

Confirma que abajo diga **v20**.

---

## 1 · Fecha del cobro

Al inscribir hay un campo nuevo, **Fecha del cobro**, justo debajo de
"Paga ahora":

- **Se pone sola igual a la fecha de inicio.** Si cargas hoy (25) a alguien que
  empezó el 19, el cobro queda anotado el 19 sin que tengas que acordarte.
- **Si la inscripción empieza más adelante**, se queda en hoy: no tendría
  sentido anotar dinero que entró en el futuro.
- **Si la cambias a mano**, deja de seguir al inicio y respeta lo que pusiste.

Esa es la fecha que usa el dashboard para el dinero.

## 2 · Filtro de fechas en el dashboard

Arriba hay cuatro botones: **Hoy · 7 días · Este mes · 📅 Elegir fechas**.
Abre en **Hoy**, como pediste. "Elegir fechas" despliega un desde/hasta.

Todo lo de abajo responde al período: ingresos, mensualidades, pases, productos.

## 3 · Las mensualidades se cuentan por cuándo empiezan

La tarjeta **"Mensualidades que empiezan"** usa la **fecha de inicio**, no la de
carga. Las de Guzmán y Carla, que empiezan el 19, cuentan el 19 aunque las
hayas registrado el 25.

Dos tarjetas siguen siendo del total y no del período, y ahora lo dicen:
**Alumnos activos** ("en total, no del período") y **Pagos pendientes** (una
deuda vieja sigue siendo deuda hoy, aunque mires solo el día de hoy).

## 4 · El gráfico se agrupa solo

Con 31 barras en un teléfono no se entiende nada, así que:

| Período | Cada barra es |
|---|---|
| hasta 14 días | un día |
| hasta 3 meses | una semana |
| más largo | un mes |

Con **Hoy** muestra igual los 7 días hasta hoy, porque una sola barra no dice nada.

---

## Lo que se probó

**Base de datos** (cadena completa 01→16 en PostgreSQL real):

- Inscripción con inicio el 19 cargada el 25 → el pago queda fechado el **19**,
  y la inscripción sigue registrando que se cargó el **25**. Las dos cosas
  quedan, ninguna se pierde.
- Sin fecha de cobro (o con null) se comporta como antes: el día de hoy.
- Verifiqué que **no quedaran dos versiones** de la función tras cambiarle la
  firma, que es lo que haría que la app no supiera a cuál llamar.
- La función la copié literal de la versión anterior y le cambié solo dos
  cosas; revisé el diff línea por línea antes de darla por buena.

**En el navegador** (33 comprobaciones, 390 y 320 px):

- Abre en Hoy; cada botón cambia los números.
- Con datos donde una inscripción se carga hoy pero empieza hace 6 días:
  en **Hoy** no aparece, en **7 días** sí. Los ingresos hacen lo mismo
  (Bs. 150 hoy → Bs. 280 en la semana).
- "Elegir fechas" acota a un solo día correctamente, y si pones el rango al
  revés avisa en vez de mostrar cualquier cosa.
- El campo de cobro sigue al inicio, no se va al futuro, y respeta lo que
  escribas a mano.
- El gráfico nunca pasa de 7 barras en teléfono y nada desborda a 320 px.

Volví a correr las pruebas de la v18 y la v19: siguen pasando.

---

## Dos cosas que conviene que sepas

**Los pases del día y las ventas de productos siguen usando el día en que los
registras.** Tiene sentido: esos se cobran en el momento. Si alguna vez
necesitas cargar un pase de ayer, dímelo y le pongo el mismo campo.

**Reportes no cambió**; sigue con su propio filtro. Si quieres que use el mismo
criterio que el dashboard, lo alineo.
