// ============================================================
// PRIME FIT · Conexión a Supabase
// 1) Crear el proyecto en https://supabase.com
// 2) Copiar de: Project Settings → API
//    - Project URL      → SUPABASE_URL
//    - anon public key  → SUPABASE_ANON_KEY
// ============================================================

const SUPABASE_URL = 'https://gmhotbwtkzaldugxmqjr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YvDeikAP3XpF6Rsro-XXrA_52kQnMZB';

// Cliente global (la librería se carga por CDN en cada página)
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
