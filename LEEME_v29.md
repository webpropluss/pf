# Prime Fit · versión 29

Recibo impreso de la inscripción, para tu GS-FJ80M-UB.

**No hay SQL nuevo.** Solo subir la carpeta. Debe decir **v29** abajo.

---

## Cómo se usa

En la lista de **Inscripciones**, cada fila tiene ahora un botón **🖨️ Recibo**.
Lo tocas y sale el diálogo de impresión del navegador; eliges la térmica y listo.

## Cómo queda el recibo

```
            PRIME FIT
     ENTRENAMIENTO SIN LÍMITES

      RECIBO DE INSCRIPCIÓN
        Tel. +591 70000000
       Av. Siempre Viva 123
- - - - - - - - - - - - - - - -
Recibo N°                    12
Emitido              13/10/2026
- - - - - - - - - - - - - - - -
ALUMNO
Juan Quispe

CLASES
Boxeo
Lu-Mi-Vi 18:00 · Marco
Zumba
Ma-Ju 20:00 · Lucía

VIGENCIA
Del 13/10/2026
al  12/11/2026
- - - - - - - - - - - - - - - -
Total                Bs. 280.00
Descuento           − Bs. 20.00
Pagado               Bs. 200.00
Saldo pendiente       Bs. 80.00
Forma de pago          Efectivo
- - - - - - - - - - - - - - - -
Atendió: Admin

      Queda saldo pendiente.
 ¡Gracias por entrenar con nosotros!
```

El teléfono y la dirección salen de **Configuración**: si los llenas ahí,
aparecen solos en todos los recibos.

---

## Tres cosas que resolví por el camino

**El logo no se podía usar tal cual.** El de la app es blanco y rojo **sobre
fondo negro**: en una térmica eso sale como un ladrillo negro que se come el
papel. Generé `img/logo_recibo.png`, la misma marca en negro sobre blanco y en
un solo tono, que es lo único que entiende una impresora térmica. Pesa 1,7 KB.

**Si la inscripción está anulada, el recibo lo dice.** Sale un recuadro
**ANULADA · SIN VALIDEZ** bien visible, para que nadie lo use como comprobante
de pago. Preferí eso a esconder el botón, porque a veces hace falta reimprimir
para archivo.

**Si queda saldo, el recibo lo canta.** Muestra Total, Pagado y Saldo pendiente,
y abajo repite *"Queda saldo pendiente"*. Si está todo pagado, esa línea no
aparece.

---

## Para que salga bien la primera vez

En Windows, la primera vez que imprimas, en el diálogo:

1. Elige la **GS-FJ80M-UB** como impresora.
2. Márgenes: **Ninguno**.
3. Desmarca **Encabezados y pies de página** (si no, Chrome imprime la URL y la fecha).
4. Escala: **100 %** o Predeterminada.

Chrome recuerda esos ajustes para la siguiente vez. El recibo ya viene con el
ancho de 80 mm y con un espacio al final para que el cortador tenga dónde cortar.

---

## Lo que se probó

**20 comprobaciones**, y además generé el recibo como **PDF de 80 mm de ancho**
para verlo tal como sale en el papel — está en la vista de arriba.

- El botón aparece en la lista y arma el recibo.
- Lleva nombre, monto total, lo pagado, el saldo, y las fechas de inicio y fin.
- Usa el logo de papel, y comprobé que la imagen **carga de verdad**, no solo que
  la ruta esté escrita.
- En pantalla el recibo no se ve; al imprimir se ve él y **se oculta toda la
  aplicación**. Medí el ancho: **302 px = 80 mm exactos**.
- Una inscripción anulada imprime la marca, con sus datos y sin restos del
  recibo anterior.
- Si la inscripción no existe, avisa y **no manda una hoja en blanco** a la
  impresora.
- Verifiqué que todo el texto quede en **negro puro**: el tema de la app es
  oscuro y algún color podía colarse. En la captura se veía rojizo, pero al
  medirlo era `rgb(0,0,0)` — era el suavizado de la pantalla, no tinta.

Las otras 14 suites siguen pasando.

---

## Lo que sigue, si quieres

El recibo de **venta de productos** y el de **pase del día** son el mismo
mecanismo: el archivo `js/recibo.js` ya está hecho para reutilizarse. Dime y los
agrego.

Y si algún día usas la impresora por **Bluetooth desde un Android**, el
contenido del recibo no cambia; solo cambiaría la forma de enviarlo.
