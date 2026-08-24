import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase compartido. Mismo proyecto y misma anon key que ya usaba
 * assets/supabase-config.js — la anon key es pública por diseño (protegida
 * por RLS, no por estar oculta, ver ese archivo para el detalle). Se
 * hardcodea acá en vez de usar variables de entorno para seguir la misma
 * convención que ya tenía el repo, no porque haga falta ocultarla.
 *
 * Un único cliente alcanza hoy porque todo el sitio (incluido el admin) se
 * autentica como usuario de Supabase y depende de RLS, nunca de
 * service_role — eso no cambia con esta migración salvo donde el spec lo
 * diga explícitamente (Route Handler de revalidación, Sprint 3).
 */
const SUPABASE_URL = "https://kyuilrlewynqrzebouww.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Q-M5uG2ChZIg0c1zPfNXiQ_unIG1hZ8";

export function supabaseBrowser() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
