# 📡 Evitar que la base se suspenda + página responsive

## 1) Ejecuta el SQL nuevo
En Supabase → SQL Editor → pega `supabase/05_ping_keepalive.sql` → Run.
Si sale el aviso, elige **"Run without RLS"** (la tabla ping es pública a propósito).

## 2) Configura el monitor externo (cron-job.org, gratis, sin tarjeta)
Llama una vez al día a la base y así no se suspende por 7 días de inactividad.

- URL (método **POST**):
  `https://gmhotbwtkzaldugxmqjr.supabase.co/rest/v1/rpc/ping_keepalive`
- Headers:
  - `apikey` = `sb_publishable_YvDeikAP3XpF6Rsro-XXrA_52kQnMZB`
  - `Content-Type` = `application/json`
- Schedule: **Every day** (a la hora que quieras).

Pasos: crea cuenta en https://cron-job.org → Create cronjob → pega la URL →
método POST → agrega los 2 headers en Advanced → guarda.

Comprobar: en Table Editor → tabla `ping`, el campo `visitas` sube y `ultima_vez`
se actualiza cada día.

## 3) La app también hace ping sola
Cada vez que alguien entra al sistema, llama a `ping_keepalive`. Mientras el
gimnasio lo use a diario, ni necesitas el monitor; el monitor es el seguro para
vacaciones o feriados largos.

## 4) Responsive (ya incluido)
- Barra superior con botón ☰ en el teléfono.
- El menú lateral se abre como cajón deslizable y se cierra al elegir una opción.
- Tarjetas del dashboard en 2 columnas (1 en pantallas muy angostas).
- Tablas con desplazamiento horizontal para no romperse.
- Formularios y modales a una sola columna; botones a lo ancho.
Nada que configurar: funciona al abrir desde el celular.
