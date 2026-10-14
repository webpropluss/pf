# Prime Fit · versión 32

Las cuatro cosas que pediste: recibo más limpio, filtro por disciplina en pases
del día y paginación en inscritos.

**No hay SQL nuevo.** Solo subir la carpeta. Debe decir **v32** abajo.

---

## 1 · El recibo

El logo bajó de 58 mm a **42 mm** de ancho (ocupa el 52 % del papel, antes el
77 %) y el espacio en blanco de arriba pasó de 4 mm a **1 mm**. No lo dejé en
cero a propósito: el papel ya avanza solo un poco al empezar, pero si lo quito
del todo el corte puede comerse la primera línea en algunas impresoras.

Y **salieron el "Recibo N°" y el "Venta N°"**, en los dos recibos, como pediste.

```
            PRIME FIT
     ENTRENAMIENTO SIN LÍMITES

      RECIBO DE INSCRIPCIÓN
        Tel. +591 70000000
       Av. Siempre Viva 123
- - - - - - - - - - - - - - - -
Emitido               14/10/2026
- - - - - - - - - - - - - - - -
ALUMNO
Juan Quispe
...
```

Un detalle que conviene que sepas: **el número sigue guardándose**. Solo dejó de
imprimirse. Si algún día necesitas rastrear un cobro, lo tienes en la lista de
Inscripciones y de Ventas, que es donde de verdad sirve. En el papel del cliente
no hacía falta.

El recibo queda unos 15 mm más corto que antes, que en rollo de 80 mm se nota.

---

## 2 · Filtro por disciplina en Pases del día

Arriba de la lista hay un combo: **Todas las disciplinas**, Boxeo, Zumba,
Híbrido… eliges una y la lista queda solo con esa.

**Las cuatro cifras de arriba también se filtran.** Esto no lo pediste, pero
dejarlas en el total mientras la lista muestra otra cosa hace leer mal la
pantalla: verías "Pases de hoy 12" con tres filas debajo. Ahora si filtras
Boxeo, "Pases de hoy" te dice cuántos pases de boxeo cobraste hoy — que además
es la pregunta que uno suele querer responder. Para que no haya confusión, al
filtrar aparece una línea que dice *"Las cifras son solo de Boxeo."*

Dos cosas que resolví por el camino:

- **Los pases viejos también se filtran bien.** Los de antes de la versión 20 no
  guardaban disciplina directa, la traían a través del horario. El filtro mira
  los dos lados, así que un pase de hace meses aparece igual al filtrar su
  disciplina.
- **El combo trae todas las disciplinas, también las desactivadas.** Si mañana
  das de baja Zumba, los pases de zumba del mes pasado seguirían ahí y no
  podrías filtrarlos. Por eso no lo limité a las activas.

Si una disciplina no tiene pases, la tabla lo dice (*"No hay pases de esa
disciplina en la lista"*) en vez de quedarse en blanco.

---

## 3 · Paginación en Inscripciones

De **20 en 20**. Abajo quedan los botones **← Anterior / Siguiente →** con
"Página 1 de 3" en medio, y una línea que dice *"Viendo 1–20 de 57
inscripciones"*.

- Si hay 20 o menos, los botones **no aparecen**: con pocos inscritos solo
  estorbarían.
- **"Anterior" se apaga en la primera página y "Siguiente" en la última**, así
  no llegas nunca a una pantalla vacía.
- Al cambiar de página la pantalla **sube sola** al principio de la lista, que
  si no uno queda mirando el pie de página.

### Cómo se lleva con el buscador

Esto es lo que más cuidado necesitaba, porque es fácil que quede mal:

- **Buscar vuelve a la página 1.** Si estabas en la 3 y escribes un nombre, te
  lleva al primer resultado, no a la página 3 de una búsqueda que tiene una
  sola.
- **El contador aclara cuándo está filtrado:** *"8 inscripciones de 57"*.
- Si lo filtrado cabe en una página, los botones desaparecen mientras dure la
  búsqueda.

El buscador sigue mirando **toda** la lista, no solo la página que estás viendo
— que es el error típico de las paginaciones hechas a medias.

---

## Lo que probé

**396 comprobaciones** en las 15 suites, todas en verde. Las nuevas de esta
versión:

**Del recibo** — además de invertir las pruebas que antes exigían el número,
ahora **comprueban que no esté**: ni "Recibo N°", ni "Venta N°", ni ningún "N°"
suelto en el papel. También mido el logo y el aire de arriba sobre el recibo
armado en modo impresión, no a ojo: 52 % del ancho y menos espacio arriba que
abajo. Si alguien vuelve a agrandarlo sin querer, la prueba falla.

Siguen pasando las que impiden que el precio de compra y la ganancia se cuelen
al papel del cliente.

**Del filtro de pases** — con cinco pases repartidos entre dos disciplinas, uno
viejo que trae la clase por el horario y uno suelto sin disciplina: que filtre
bien los tres casos, que las cuatro cifras bajen con el filtro, que el aviso
aparezca y se vaya, y que una disciplina sin pases no deje la tabla muda.

**De la paginación** — con 57 inscripciones de prueba: que dibuje 20 y no 57,
que la segunda página traiga otras 20 (no las mismas), que la última traiga las
17 que sobran, que los botones se apaguen en los extremos, y el caso que más me
preocupaba: **estar en la página 3 y buscar algo que tiene un solo resultado no
puede dejar la tabla en blanco**.

Más los dos PDF a 80 mm reales, para ver el papel como va a salir.

---

## Lo que quedó pendiente

- Recibo para los pases del día — dijiste que por ahora no.
- Usar el logo nuevo también en la pantalla de inicio y en el menú lateral.
- Permisos por rol en la base de datos (hoy la restricción es solo de pantalla).
