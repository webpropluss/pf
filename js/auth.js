// ============================================================
// PRIME FIT · Autenticación (Supabase Auth)
// ============================================================

/** Devuelve la sesión activa o null. */
async function sesionActual() {
  const { data } = await db.auth.getSession();
  return data.session;
}

/** Inicia sesión con correo y contraseña. */
async function iniciarSesion(email, clave) {
  const { error } = await db.auth.signInWithPassword({ email, password: clave });
  if (error) {
    const msg = error.message.includes('Invalid login credentials')
      ? 'Correo o contraseña incorrectos.'
      : 'No se pudo iniciar sesión: ' + error.message;
    return { exito: false, mensaje: msg };
  }
  return { exito: true };
}

/** Cierra la sesión y vuelve al login. */
async function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  await db.auth.signOut();
  location.replace('index.html');   // replace: el panel no queda en el historial
}

/**
 * Protege una página: si no hay sesión redirige al login.
 * Devuelve el perfil { nombre, rol } del usuario conectado.
 */
async function requerirSesion() {
  const sesion = await sesionActual();
  if (!sesion) { location.replace('index.html'); return null; }

  const { data: perfil } = await db
    .from('perfiles')
    .select('nombre, rol, activo')
    .eq('id', sesion.user.id)
    .single();

  if (!perfil || !perfil.activo) {
    await db.auth.signOut();
    location.replace('index.html');
    return null;
  }
  return perfil;
}
