# 💵 Cobrar al inscribir · y qué hacer cuando el alumno vuelve

## 1) El cobro, en el mismo acto de inscribir

En el formulario de inscripción hay una sección nueva al final:

```
COBRO
Paga ahora (Bs.)  [150]     ← viene con el total ya puesto
```

- Viene **lleno con el total**, así que normalmente solo guardas.
- Si paga **menos**, la diferencia queda como saldo pendiente en Pagos.
- Si pones **0**, no se cobra nada ahora (queda pendiente, como antes).

El resumen de abajo te lo dice en el momento:
*"Bs. 150.00 · paga ahora Bs. 100.00 · **queda debiendo Bs. 50.00**"*

Si intentas cobrar más que el total, el sistema lo ajusta al total.

---

## 2) Tu escenario: se va y vuelve a los 20 días

Aquí encontré **una falla de diseño mía** que había que corregir antes.

### El problema que tenías
Si el alumno tiene una inscripción vigente, el sistema **no te deja hacerle
otra** en el mismo horario. Y para liberarlo había dos caminos, los dos malos:

- **Eliminar** → borraba también su pago. Si ya había pagado su mes y vino
  10 días, ese dinero el gimnasio lo ganó. Borrarlo te descuadraba la caja.
- **Anular** → hacía exactamente lo mismo: borraba los pagos. Ese era el error.

### Cómo quedó
**Anular (🚫) ya no borra el dinero.** Ahora hace lo correcto:

- Libera la plaza en la clase ✅
- **Conserva el pago** en los reportes ✅
- Deja la inscripción marcada como anulada ✅
- Te permite hacerle una inscripción nueva con otras fechas ✅

Y el mensaje de error al intentar reinscribir ahora te dice qué hacer:
*"El alumno ya tiene una inscripción vigente en ese horario. Anúlala primero
(🚫) si volvió con fechas nuevas."*

### El procedimiento, entonces
1. El alumno deja de venir → **🚫 Anular** su inscripción.
2. Vuelve a los 20 días → **nueva inscripción** con la fecha de hoy, y cobras
   en el acto.
3. Su pago anterior **sigue contando** en los ingresos del gimnasio.

Comprobado de punta a punta: se inscribe pagando 150 → intenta reinscribirse y
lo bloquea → se anula (plaza libre, los 150 se conservan) → nueva inscripción
pagando 150 → **caja total Bs. 300**, que es lo correcto.

---

## 3) Eliminar inscripción: ya existía

El botón **🗑️** está en Inscripciones desde la versión anterior (solo
administrador). Si no te aparece, es porque falta ejecutar
`supabase/09_eliminar_catalogos.sql`.

### 🚫 Anular vs. 🗑️ Eliminar

| | Qué hace | Cuándo |
|---|---|---|
| **🚫 Anular** | Libera la plaza, **conserva el pago** | El alumno dejó de venir, aunque haya pagado |
| **🗑️ Eliminar** | Borra todo, **incluidos los pagos** | Fue un error o una prueba |

La regla simple: si el dinero **entró de verdad**, usa Anular.
Eliminar es solo para limpiar errores.

---

## ⚠ Ejecutar este SQL

`supabase/11_cobro_al_inscribir.sql` en el SQL Editor → **Run**.

Y si nunca ejecutaste `09_eliminar_catalogos.sql`, hazlo también (es el que
trae el botón de eliminar inscripciones).

---

## Archivos modificados
- `js/inscripciones.js` — campo de cobro y mensajes corregidos
- `supabase/11_cobro_al_inscribir.sql` — ⚠ hay que ejecutarlo
- `index.html`, `app.html` — `?v=11` · `sw.js` — `primefit-v11`

El menú lateral debe decir **v11**.
