-- ============================================================
-- PRIME FIT · Etapa 5: programar el aviso diario de WhatsApp
-- Ejecutar en el SQL Editor DESPUÉS de desplegar la Edge Function.
--
-- ⚠ Antes de ejecutar, reemplaza:
--   TU-PROYECTO  → la referencia de tu proyecto (la de la URL)
--   TU_ANON_KEY  → tu anon public key (Project Settings → API)
-- ============================================================

-- Extensiones necesarias (en Supabase se activan con esto o desde
-- Database → Extensions: pg_cron y pg_net)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Quitar la tarea si ya existía (permite re-ejecutar este script)
select cron.unschedule('aviso-whatsapp-diario')
where exists (select 1 from cron.job where jobname = 'aviso-whatsapp-diario');

-- Ejecutar todos los días a las 09:00 de Bolivia (13:00 UTC)
select cron.schedule(
  'aviso-whatsapp-diario',
  '0 13 * * *',
  $$
  select net.http_post(
    url     := 'https://TU-PROYECTO.supabase.co/functions/v1/aviso-whatsapp',
    headers := jsonb_build_object(
      'Authorization', 'Bearer TU_ANON_KEY',
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Ver las tareas programadas:
--   select * from cron.job;
-- Ver el historial de ejecuciones:
--   select * from cron.job_run_details order by start_time desc limit 20;
