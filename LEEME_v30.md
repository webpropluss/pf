# Prime Fit · versión 30

Recibo impreso también para las ventas de productos.

**No hay SQL nuevo.** Solo subir la carpeta. Debe decir **v30** abajo.

---

## Cómo se usa

En **Ventas**, cada venta de la lista tiene ahora **🖨️ Recibo**, igual que en
Inscripciones.

## Cómo queda

```
            PRIME FIT
     ENTRENAMIENTO SIN LÍMITES

         RECIBO DE VENTA
        Tel. +591 70000000
       Av. Siempre Viva 123
- - - - - - - - - - - - - - - -
Venta N°                      3
Emitido      13/10/2026, 03:30 p.m.
- - - - - - - - - - - - - - - -
PRODUCTOS
2× Bucal Venum
Simple, transparente, con estuche
Bs. 35.00 c/u          Bs. 70.00

1× Proteína Whey 2lb
Chocolate
Bs. 280.00 c/u        Bs. 280.00

1× Agua 600 ml
Bs. 6.50 c/u            Bs. 6.50
- - - - - - - - - - - - - - - -
Subtotal              Bs. 76.50
Descuento            − Bs. 6.50
Total                 Bs. 70.00
Forma de pago                QR
4 artículos
- - - - - - - - - - - - - - - -
Atendió: Caja

      ¡Gracias por tu compra!
```

La **descripción** del producto sale debajo del nombre, que es justo para lo que
la pusimos: así el cliente ve cuál de los tres bucales se llevó.

---

## Dos decisiones

**El recibo del cliente no lleva costos ni ganancia.** La venta sí los guarda
—los necesitas en Reportes— pero en el papel que se le entrega al cliente no
tienen por qué aparecer. Puse una prueba específica para que nunca se cuelen por
descuido en un cambio futuro.

**El subtotal y el descuento solo salen si hubo descuento.** Si no lo hubo, el
recibo muestra el total directo y queda más corto, que en papel se agradece.

Una venta anulada imprime la marca **ANULADA · SIN VALIDEZ**, igual que las
inscripciones.

---

## Un cambio por debajo

Saqué el encabezado (logo, nombre, teléfono, dirección) y el pie (quién atendió,
agradecimiento, el espacio para el cortador) a dos funciones comunes. Los dos
recibos las usan, así que si mañana cambias el teléfono del gimnasio o quieres
otro texto de despedida, se toca en un solo lugar y los dos quedan iguales.

---

## Lo que se probé

**32 comprobaciones** entre los dos recibos, más los dos PDF a 80 mm reales.

Del recibo de venta:

- El botón aparece en la lista y arma el recibo.
- Lleva número, fecha y hora, cada producto con su cantidad, su descripción y su
  precio unitario, el subtotal, el descuento, el total y la forma de pago.
- **No lleva el precio de compra (40.83) ni la ganancia (29.17)**, ni las
  palabras "costo" o "ganancia". Esto lo comprobé con la venta cargada con esos
  datos, para que la prueba falle si algún día se filtran.

Las 14 suites anteriores siguen pasando, incluido el recibo de inscripción.

---

## Pases del día

Lo dejé fuera, como pediste. Si cambias de opinión es poco trabajo: el
mecanismo ya está y solo habría que armar el cuerpo del recibo.
