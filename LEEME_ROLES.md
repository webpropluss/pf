# 👤 Qué ve cada rol

## Lo que cambió

El rol **Caja (Cajero)** ya no ve **Disciplinas, Horarios, Instructores,
Reportes ni Asistencia**. Le queda solo lo que necesita para atender:

| Rol | Módulos que ve |
|---|---|
| **Administrador** | Todo (incluye Usuarios y Configuración) |
| **Cajero** | Dashboard · Alumnos · Inscripciones · Pagos · Pases del día |
| **Recepcionista** | Todo menos Usuarios y Configuración |
| **Instructor** | Todo menos Usuarios y Configuración |

Recepción e Instructor **quedaron igual que antes**; solo se tocó Caja.

## Cómo está hecho

Los módulos prohibidos **no aparecen en el menú**, y además **no se puede
entrar por otro camino**: si se intenta abrir uno, sale una pantalla que dice
*"Tu rol (Cajero) no tiene acceso a Reportes"*.

Comprobado con los cuatro roles: el menú de Caja muestra solo sus 5 módulos,
y los 5 prohibidos quedan bloqueados aunque se fuercen.

## Para cambiar los permisos después

Todo está en **un solo lugar**: `js/app.js`, arriba, en la lista `PERMISOS`:

```js
const PERMISOS = {
  Administrador: Object.keys(modulos),          // ve todo
  Cajero: ['dashboard', 'alumnos', 'inscripciones', 'pagos', 'pases'],
};
```

- Para que Caja vea también Asistencia, se agrega `'asistencia'` a esa lista.
- Para limitar a Recepción, se agrega una línea `Recepcionista: [...]`.
- Un rol que no esté en la lista ve todo menos Usuarios y Configuración.

Los nombres de los módulos son: `dashboard`, `alumnos`, `disciplinas`,
`horarios`, `instructores`, `inscripciones`, `pagos`, `pases`, `asistencia`,
`reportes`, `usuarios`, `configuracion`.

---

## ⚠ Hasta dónde llega esta protección

Esto **oculta los módulos de la pantalla**, que es lo que pediste y es
suficiente para el uso diario del gimnasio.

Lo que **no** hace: la base de datos sigue permitiendo que cualquier usuario
con sesión lea los datos. Alguien con conocimientos técnicos podría
consultarlos por fuera del sistema. Si en algún momento quieres un candado
de verdad — que la base misma rechace a Caja — se puede hacer con reglas por
rol en Supabase; avísame y lo preparamos.

---

## Archivos modificados
- `js/app.js` — tabla de permisos por rol y bloqueo de acceso
- `app.html` — el menú ya se filtra solo por la tabla
- `index.html`, `app.html` — `?v=9` · `sw.js` — `primefit-v9`

**No hay SQL.** El menú lateral debe decir **v9**.
