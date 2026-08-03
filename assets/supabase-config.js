/* Config del backend de cuentas (Supabase).
 *
 * Estos dos valores salen de tu proyecto en supabase.com → Project Settings →
 * API. Copiá el "Project URL" y la clave "anon" "public" (NUNCA la
 * "service_role": esa da acceso total y no debe estar en ningún archivo del
 * sitio). La anon key es pública por diseño — queda protegida por las
 * políticas de Row Level Security de la base, no por estar oculta.
 *
 * Mientras estos valores sigan siendo los de ejemplo de abajo, el modal de
 * cuenta va a mostrar un error al intentar crear una cuenta o iniciar sesión:
 * es la señal de que todavía falta pegar los datos reales acá.
 */
window.MM_SUPABASE = {
  url: 'https://kyuilrlewynqrzebouww.supabase.co',
  anonKey: 'sb_publishable_Q-M5uG2ChZIg0c1zPfNXiQ_unIG1hZ8',

  // Sitekey pública de Cloudflare Turnstile (dash.cloudflare.com → Turnstile
  // → Add site). Es pública a propósito, va en el HTML — la Secret Key NO va
  // acá, esa se pega sólo en Supabase (Authentication → Attack Protection).
  // Dominios cargados en Cloudflare para esta sitekey: mundomagico.ar,
  // www.mundomagico.ar, mundo-magico-prueba.netlify.app y localhost.
  // "Enable CAPTCHA protection" en Supabase recién se puede prender DESPUÉS
  // de pegar ahí la Secret Key correspondiente a esta misma sitekey.
  turnstileSiteKey: '0x4AAAAAAECQq0Yu3dLrZtNE'
};
