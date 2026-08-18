// ============================================================
// PRIME FIT · Conexión a Supabase
// 1) Crear el proyecto en https://supabase.com
// 2) Copiar de: Project Settings → API
//    - Project URL      → SUPABASE_URL
//    - anon public key  → SUPABASE_ANON_KEY
// ============================================================

const SUPABASE_URL = 'https://eaqwrpjhjpjsjogvdfbq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_s1qRrwsElOJVxVr30nHSnA_QWVTSjLB';

// Cliente global (la librería se carga por CDN en cada página)
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
