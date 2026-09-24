# 🎟️ Pase del día: solo nombre y monto

## Qué cambió

Tenías razón: yo obligaba a poner el teléfono para registrar un pase del día.
Eso era un estorbo que puse de más — alguien que viene un solo día no necesita
recibir avisos de vencimiento.

**Ahora el pase del día pide lo mínimo:**

```
¿Quién entrena hoy?   [＋ Visitante nuevo]
Nombre del visitante  [Juan Pérez]
Celular (opcional)    [ +591 |          ]   ← se puede dejar vacío
Fecha                 [24/9/2026]
Monto Bs.             [10]
                      [Registrar pase]
```

Nombre, monto, registrar. Listo.

El celular quedó **opcional**, solo por si quieres invitarlo después a sacar
mensualidad. Para un pase suelto no hace falta.

## Y sí, el pase se cobra solo

Confirmado lo que decías: **no necesitas pasar por Pagos**. Al registrar el
pase, el cobro se anota automáticamente y ya aparece en el Dashboard, en la
caja del día y en Reportes.

---

## Un efecto secundario que resolví

Los visitantes se guardan como alumnos (el sistema los necesita así para la
asistencia y el historial). Con el teléfono ya opcional, ibas a registrar
muchos más, y en un mes tu lista de Alumnos se habría llenado de gente que
vino una sola vez.

Por eso ahora:

- Los visitantes reciben un código **`VIS-`** en vez de `ALU-`, y en la lista
  salen con una etiqueta amarilla **Visitante**.
- El módulo Alumnos tiene un **filtro** arriba:

```
Todos (37)  ·  Con mensualidad (12)  ·  Visitantes de pase del día (25)
```

Así encuentras a tus alumnos de mensualidad sin que los visitantes estorben,
pero sin perderlos de vista.

> Si un visitante después saca mensualidad, lo inscribes normalmente. Su
> código seguirá diciendo `VIS-`; si te molesta, se puede editar a mano en
> Supabase, o me dices y le agrego un botón para convertirlo.

---

## Comprobado
- Registrar un pase **solo con nombre y monto**, sin teléfono → guarda ✅
- Registrar con teléfono → también guarda ✅
- El filtro de Alumnos separa bien los 3 casos ✅

---

## Archivos modificados
- `js/pases.js` — teléfono opcional y código `VIS-`
- `js/alumnos.js` — filtro y etiqueta de visitante
- `index.html`, `app.html` — `?v=13` · `sw.js` — `primefit-v13`

**No hay SQL.** El menú lateral debe decir **v13**.
