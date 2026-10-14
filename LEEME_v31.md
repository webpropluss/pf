# Prime Fit · versión 31

El logo nuevo en los dos recibos.

**No hay SQL nuevo.** Solo subir la carpeta. Debe decir **v31** abajo.

---

## Qué cambió

Un solo archivo: `img/logo_recibo.png`. Como los dos recibos ya apuntaban al
mismo sitio, no hubo que tocar nada de código.

## Cómo lo convertí

El logo que me pasaste tiene **"PRIME" en rojo con degradado**, **"FIT" en
blanco** y, de fondo, una **foto del gimnasio** en gris oscuro. Una térmica solo
quema negro sobre papel: no hay colores ni grises de verdad. Así que hubo que
separar las letras del fondo.

No servía el truco de la vez pasada (quedarse con "lo más claro que el fondo"),
porque esta vez el fondo es una foto y tiene zonas claras. Lo resolví mirando
**color y brillo a la vez**: el rojo de "PRIME" está muy saturado, el "FIT" es
muy claro, y el fondo es gris apagado — eso los separa bien.

Aun así se colaba **un reflejo del equipo del gimnasio** en la esquina superior
derecha, y era lo bastante grande como para no poder descartarlo solo por
tamaño. Lo quité porque queda muy por encima de la línea del texto: agrupé los
trazos y me quedé con los que están en la banda de las letras.

El resultado es la marca completa —PRIME, FIT y los guiones— en negro puro,
recortada al ras y de 1,3 KB.

---

## Lo que se probó

- Las 15 suites siguen pasando, incluidas las 32 comprobaciones de los recibos.
- Regeneré los dos PDF a 80 mm reales y los revisé: el logo entra completo, sin
  el reflejo, y se lee bien al tamaño del papel.
- La prueba que verifica que **la imagen carga de verdad** (no solo que la ruta
  esté escrita) sigue pasando con el archivo nuevo.

---

## Una cosa que no toqué

El logo **de la pantalla** sigue siendo el anterior: cambié solo el de los
recibos, que es lo que pediste. Si quieres que el nuevo también aparezca en el
login y en la barra lateral, dímelo y lo cambio — ahí sí se puede usar a todo
color, porque no hay que convertirlo a blanco y negro.
