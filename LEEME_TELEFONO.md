# 📞 Solo los 8 dígitos: el 591 va solo

## Cómo quedó

Al lado del campo de celular ahora está fijo el **+591**, y tú escribes
únicamente los 8 dígitos:

```
CELULAR (WHATSAPP)
┌──────┬──────────────────────┐
│ +591 │  71234567            │
└──────┴──────────────────────┘
```

Por detrás el sistema guarda `59171234567`, que es el formato que necesita
WhatsApp. Tú nunca lo escribes ni lo ves en el formulario.

### Dónde se aplica
- **Alumnos** (obligatorio, es el que recibe el aviso)
- **Pases del día** → visitante nuevo
- **Instructores** (opcional)

### Detalles que tiene
- El teclado del teléfono se abre **en modo numérico**.
- El campo **no deja escribir más de 8 dígitos**.
- Al **editar** un alumno ya cargado, muestra solo sus 8 dígitos aunque esté
  guardado con el 591.
- En las listas se ve como **+591 71234567**.
- Si te falta o te sobra un dígito, avisa: *"El celular debe tener 8 dígitos;
  escribiste 7."*
- Si por costumbre pegas el número completo con el 591, **igual lo acepta** y
  lo acomoda solo.

---

## ⚠ Ejecutar este SQL una vez

`supabase/10_normalizar_telefonos.sql` en el SQL Editor → **Run**.

Acomoda los números que ya tienes cargados para que todos queden en
`591 + 8 dígitos`:

| Antes | Después |
|---|---|
| `71234567` | `59171234567` |
| `+591 7234 5678` | `59172345678` |
| `59176000003` | queda igual |

Al final el script **te muestra una lista** de los números que quedaron raros
(vacíos o incompletos) para que los corrijas a mano. Se puede ejecutar varias
veces sin problema.

---

## Si algún día atiendes a alguien de otro país

El código está en **un solo lugar**: `js/config.js`, en la línea

```js
const CODIGO_PAIS = '591';
```

Cambiarlo ahí lo cambia en todo el sistema.

---

## Archivos modificados
- `js/config.js` — el código de país
- `js/ui.js` — funciones del teléfono (armar, separar, mostrar, validar)
- `js/alumnos.js`, `js/pases.js`, `js/catalogos.js`, `js/dashboard.js`
- `css/estilos.css` — estilo del campo con prefijo
- `index.html`, `app.html` — `?v=8` · `sw.js` — `primefit-v8`

El menú lateral debe decir **v8**.
