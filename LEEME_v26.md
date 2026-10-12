# Prime Fit · versión 26

Las tres cosas que pediste. **No hay SQL nuevo**: solo subir archivos.

> Pero el **SQL 19 sigue pendiente** — sin él el pase del día no guarda.
> Es el mismo error que te salió el sábado.

---

## 1 · Filtro de instructor en Reportes

Junto al de disciplina hay otro combo: **Todos los instructores** o uno en
concreto. Los dos se combinan, que es justo tu caso:

```
[ Híbrido ▾ ]  [ Marco ▾ ]   →  solo los inscritos de híbrido con Marco
[ Híbrido ▾ ]  [ Lucía ▾ ]   →  solo los de híbrido con Lucía
[ Todas   ▾ ]  [ Marco ▾ ]   →  todo lo de Marco, en cualquier disciplina
```

Si un alumno lleva híbrido con Marco **y** boxeo con otro, al filtrar por Marco
solo se cuenta su híbrido, no el boxeo.

En la vista general hay además una tabla **Por instructor**: alumnos, clases
dictadas y mensualidades de cada uno. El Excel lleva esa hoja también.

### Una limitación que prefiero decirte de frente

**Los pases del día no registran instructor.** Cuando simplificamos ese
formulario quedó guardando la disciplina, pero no quién dio la clase. Así que al
filtrar por instructor, la tarjeta de pases muestra **—** y lo explica, en vez de
inventar un número; el *total generado* es solo de mensualidades.

Si quieres atribuir los pases a un instructor, hay que volver a pedir ese dato
en el formulario del pase. Dime y lo agrego — pero sería un campo más en el
formulario que acabamos de aligerar.

## 2 · El horario en la lista de Inscripciones

La columna ahora es **Clases**, y cada una muestra su disciplina, su horario y
su instructor:

```
CLASES   ● Boxeo
         Lu-Mi-Vi 18:00 · Marco
         ● Boxeo
         Ma-Ju 07:00 · Marco
```

Antes, si un alumno llevaba dos horarios de la misma disciplina se mostraba una
sola etiqueta. Ahora se ven **los dos**, porque la gracia es saber a cuál va.

El buscador también los encuentra: puedes escribir `lucía`, `20:00` o `boxeo`,
además del nombre.

## 3 · Cantidad en el pase del día

Campo nuevo, por defecto en **1**. Si llegan 5 juntos pones 5, y se registran
**5 pases separados de Bs. 15 cada uno** — no uno de Bs. 75, que era justo lo
que no querías.

Antes de guardar lo dice con todas las letras, y el botón lleva el total:

```
¿CUÁNTOS PASES?   [ 5 ]
Son 5 pases de Bs. 15.00 cada uno: se cobra Bs. 75.00.

              [ Cancelar ]  [ Registrar Bs. 75.00 ]
```

Quedan como 5 registros independientes, así que "Pases de hoy" cuenta 5 y si uno
fue un error borras solo ese. El tope por registro es 50.

**Cómo lo hice y por qué:** la app los manda uno por uno, no con una función
nueva en la base. Así **no tienes que ejecutar otro SQL** — que es donde se te
ha trabado todo. El costo es que, si se corta el internet a la mitad, podrían
quedar 3 de 5; en ese caso te avisa *"Se registraron 3 de 5"* y completas los
que falten.

---

## Lo que se probó

**23 comprobaciones nuevas**, con un caso armado como el tuyo: híbrido dictado
por **dos** instructores (Marco y Lucía), más un alumno que lleva híbrido y boxeo
a la vez.

- Híbrido sin filtrar instructor → 3 inscritos; con Marco → 2; con Lucía → 1.
- De quien lleva híbrido y boxeo, al filtrar por Marco se cuenta solo el híbrido.
- Filtrando solo por instructor (sin disciplina), Marco suma sus dos disciplinas.
- Al filtrar por instructor, los pases muestran "—" y el total no los incluye.
- En Inscripciones se ven horario e instructor, y los dos horarios de boxeo de
  Juan aparecen por separado.
- El buscador encuentra por instructor, por hora y por nombre.
- Con cantidad 5 se mandan **5 registros de Bs. 15**, ninguno de 75, todos el
  mismo día.
- A 320 px no desborda nada en ninguna de las tres pantallas.

Las otras 11 suites siguen pasando.
