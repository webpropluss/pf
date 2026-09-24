# 🔑 Caja ya puede anular y eliminar inscripciones

## Por qué no te aparecían

Los botones 🚫 y 🗑️ estaban puestos **solo para Administrador**. Como
entraste con el usuario de **Caja**, las tarjetas se veían sin botones.
No era un problema de la v11 ni de la instalación.

## Cómo quedó

| Rol | 🚫 Anular | 🗑️ Eliminar |
|---|---|---|
| **Administrador** | ✅ | ✅ |
| **Cajero** | ✅ | ✅ |
| **Recepcionista** | ✅ | ❌ |

Recuerda la diferencia, que importa mucho para las cuentas:

- **🚫 Anular** → libera la plaza y **conserva el pago**. Es la de todos los
  días: el alumno dejó de venir, y cuando vuelve le haces una inscripción
  nueva con fechas nuevas.
- **🗑️ Eliminar** → borra la inscripción **y sus pagos**. Solo para errores
  y pruebas.

---

## ⚠ Lo que deberías saber

Al darle 🗑️ a Caja, esa persona **puede borrar registros de dinero** y eso no
queda rastreado. En un gimnasio chico donde tú mismo atiendes, no hay
problema. Si mañana contratas a alguien para la caja, conviene quitárselo.

**Se quita con una línea**, en `js/app.js`:

```js
const PERMISOS_ACCION = {
  anular:   ['Administrador', 'Cajero', 'Recepcionista'],
  eliminar: ['Administrador', 'Cajero'],   // ← borrar 'Cajero' de aquí
  eliminarPago: ['Administrador'],
};
```

Con esa misma lista puedes, al revés, darle a Recepción el 🗑️, o dejar que
Caja borre pagos sueltos desde el módulo Pagos (`eliminarPago`).

---

## De paso: los roles ahora toleran variaciones

Antes el sistema comparaba el nombre del rol exacto. Si en la base estaba
escrito `cajero` en minúsculas o con un espacio de más, los permisos no se
aplicaban y era difícil darse cuenta. Ahora compara sin importar mayúsculas
ni espacios.

---

## Comprobado
Con los tres roles, sobre una inscripción vigente y una anulada:

- **Cajero** → 🚫 y 🗑️ en la vigente, 🗑️ en la anulada ✅
- **Administrador** → igual ✅
- **Recepcionista** → solo 🚫 ✅

---

## Archivos modificados
- `js/app.js` — lista de permisos por acción
- `js/inscripciones.js`, `js/pagos.js` — usan esa lista
- `index.html`, `app.html` — `?v=12` · `sw.js` — `primefit-v12`

**No hay SQL.** El menú lateral debe decir **v12**.
