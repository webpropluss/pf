# 🔧 Corregido: "Agrega al menos una disciplina"

## Qué pasaba de verdad

Tenías razón: **sí podías seleccionar la disciplina**, aunque el campo
estuviera desbordado. El problema era otro, y más de fondo:

> **Seleccionar la disciplina no era lo mismo que agregarla.**

El formulario pedía dos pasos: elegir disciplina + horario, y *después* tocar
un botón **＋** para meterla en la lista de la inscripción. Ese botón estaba
empujado fuera de la pantalla, así que era invisible. Por eso, al dar
*Guardar*, la lista seguía vacía ("Sin clases agregadas todavía") y salía el
mensaje.

## Cómo quedó

**1. El sistema ya no te castiga por eso.**
Si elegiste disciplina y horario y das *Guardar inscripción* directamente,
**la clase se agrega sola** y la inscripción se registra. Es lo que querías
hacer, así que el sistema lo hace.

**2. El botón ahora se ve.**
En el teléfono va solo, a todo el ancho y con texto: **＋ Agregar clase**.
Sigue sirviendo para cuando inscribes a alguien en **varias disciplinas**:
agregas una, luego otra, y así.
En la computadora sigue siendo el **＋** compacto.

**3. Los mensajes dicen qué falta.**
- Sin elegir nada → *"Elige la disciplina y su horario, y toca ＋ Agregar clase."*
- Con disciplina pero sin horario → *"Falta elegir el horario de la clase."*

**4. Los campos ya no se desbordan** en ningún formulario del sistema.

## Comprobado

Los cuatro casos, en teléfono y tocando con el dedo:

| Caso | Resultado |
|---|---|
| Elegir todo y dar Guardar **sin** tocar ＋ | ✅ se agrega sola y registra |
| Dar Guardar sin elegir nada | ✅ avisa qué falta |
| Elegir disciplina pero no horario | ✅ avisa que falta el horario |
| Camino normal (tocar ＋ y guardar) | ✅ sigue funcionando |

Y los 6 formularios del sistema en tres tamaños de teléfono:
**0 px de desborde, ningún botón oculto.**

---

## Los dos descuentos (recordatorio)

En tu captura pusiste **20** en *DESCUENTO (BS.)*:

| Campo | Para qué es |
|---|---|
| **PRECIO BS. (editable)**, arriba | Precio especial de **esa clase**. Pones `130` y queda guardado que el normal era 150. |
| **DESCUENTO (BS.)**, abajo | Rebaja suelta sobre el **total** de la inscripción. |

Para la promoción de inauguración conviene el primero: queda registrado por
disciplina y aparece en Reportes → *Descuentos otorgados*.

---

## Archivos modificados
- `js/inscripciones.js` — agrega la clase sola al guardar + mensajes claros
- `css/estilos.css` — campos que no desbordan, botón a todo el ancho en móvil
- `index.html`, `app.html` — `?v=7`
- `sw.js` — `primefit-v7`

**No hay SQL.** El menú lateral debe decir **v7**.
