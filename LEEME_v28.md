# Prime Fit · versión 28

Los avisos de WhatsApp ahora muestran foto, disciplina y horario.

---

## No hay SQL nuevo

Solo subir la carpeta. Debe decir **v28** abajo.

> Si todavía no corriste el **SQL 20**, ese sigue pendiente (es el del pase del
> día con horario y cantidad). Esta versión no agrega ninguno más.

---

## Cómo queda

En **Mensualidades por vencer**, cada aviso trae ahora:

```
   ( foto )
ALUMNO      Yoissi Miranda
CLASE       ● Boxeo
            Lu-Mi-Vi 18:00
            ● Híbrido
            Lu-Mi-Vi 06:00
TELÉFONO    +591 70000072
VENCE       15/10/2026
AVISO       Sin enviar
            [ 📲 Abrir WhatsApp ]
```

- **La foto** del alumno, igual que en Alumnos. Si no tiene, salen sus
  iniciales en lugar de un hueco.
- **La disciplina** con su color, el mismo que en Inscripciones y Reportes: zumba
  siempre del mismo color, boxeo del suyo.
- **El horario** debajo de cada disciplina. Si lleva dos clases, se ven las dos,
  cada una con su horario.

El botón de WhatsApp, el mensaje y el **✓ Ya lo envié** funcionan igual que antes.

---

## Cómo lo hice

Sin tocar la base de datos. La consulta que arma esa lista solo devuelve nombre
y teléfono, así que la app pide la foto y las clases aparte, en una segunda
consulta, y las junta. Preferí eso a cambiar la función en Supabase y hacerte
ejecutar otro SQL.

También arreglé algo preventivo: al tocar **✓ Ya lo envié**, el código buscaba
"la primera etiqueta de la fila" para cambiarla a *Enviado*. Con las columnas
nuevas eso era frágil, así que ahora busca la etiqueta del aviso por lo que es,
no por su posición.

---

## Lo que se probó

**20 comprobaciones**, con dos alumnas: una con foto y una clase, otra sin foto
y con dos clases.

- La que tiene foto la muestra; la que no, sus iniciales (**YM**).
- Salen las tres clases, con zumba y boxeo en colores distintos.
- Se ve el horario de cada una, incluidos los dos de quien lleva dos clases.
- **Nada de lo anterior se rompió**: nombres, teléfono, los botones de WhatsApp,
  el enlace `wa.me` con su número y el mensaje con su nombre.
- Marcar como enviado cambia la etiqueta a *Enviado* sin borrar el resto de
  la fila.
- Con un nombre y una disciplina largos, a 320 px no desborda nada.

Las otras 13 suites siguen pasando.
