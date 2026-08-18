// ============================================================
// PRIME FIT · Edge Function: aviso-whatsapp
// Se ejecuta cada mañana (programada con pg_cron) y envía un
// mensaje de WhatsApp a los alumnos cuya inscripción vence pronto.
//
// Desplegar con:  supabase functions deploy aviso-whatsapp
// Secretos necesarios (supabase secrets set ...):
//   WHATSAPP_TOKEN     → token permanente de la app de Meta
//   WHATSAPP_PHONE_ID  → Phone Number ID de WhatsApp Cloud API
// ============================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // clave de servicio: solo vive en el servidor
  );

  // 1. Leer configuración (días de anticipación y plantilla del mensaje)
  const { data: config } = await supabase.from("config").select("clave, valor");
  const conf: Record<string, string> = {};
  (config ?? []).forEach((c) => (conf[c.clave] = c.valor));

  const dias = parseInt(conf.dias_aviso_whatsapp ?? "3", 10);
  const plantilla = conf.mensaje_whatsapp ??
    "Hola {nombre} 👋 Tu mensualidad en Prime Fit vence el {fecha}. ¡Renueva a tiempo! 💪";

  // 2. Buscar inscripciones por vencer que aún no recibieron aviso
  const { data: porVencer, error } = await supabase
    .rpc("inscripciones_por_vencer", { p_dias: dias });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!porVencer?.length) {
    return Response.json({ ok: true, enviados: 0, mensaje: "Nada por vencer hoy." });
  }

  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
  let enviados = 0;

  // 3. Enviar el mensaje a cada alumno y registrar el resultado
  for (const v of porVencer) {
    const fechaBonita = new Date(v.fecha_fin + "T00:00:00")
      .toLocaleDateString("es-BO", { day: "numeric", month: "long" });
    const mensaje = plantilla
      .replaceAll("{nombre}", v.alumno_nombre)
      .replaceAll("{fecha}", fechaBonita);

    let estado = "enviado";
    let detalleError = "";

    if (!token || !phoneId) {
      estado = "error";
      detalleError = "Faltan los secretos WHATSAPP_TOKEN / WHATSAPP_PHONE_ID.";
    } else {
      try {
        const resp = await fetch(
          `https://graph.facebook.com/v19.0/${phoneId}/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: v.telefono,             // formato: código de país + número, ej. 59171234567
              type: "text",
              text: { body: mensaje },
            }),
          },
        );
        if (!resp.ok) {
          estado = "error";
          detalleError = (await resp.text()).slice(0, 500);
        } else {
          enviados++;
        }
      } catch (e) {
        estado = "error";
        detalleError = String(e).slice(0, 500);
      }
    }

    // Registrar el aviso (el unique por inscripción evita duplicados)
    await supabase.from("avisos_whatsapp").upsert({
      alumno_id: v.alumno_id,
      inscripcion_id: v.inscripcion_id,
      telefono: v.telefono,
      mensaje,
      estado,
      detalle_error: detalleError,
    }, { onConflict: "inscripcion_id" });
  }

  return Response.json({ ok: true, encontrados: porVencer.length, enviados });
});
