/**
 * Headers de seguridad, portados acá desde public/_headers (Sprint 0 los
 * había dejado sólo en _headers, asumiendo que el Next Runtime de Netlify
 * los aplicaba igual que a un sitio estático — no era así: `_headers`
 * sólo llega a los assets realmente estáticos servidos directo por la CDN
 * de Netlify; las páginas que sirve la función de Next.js (home, /[mundo],
 * /explorar, /pedido, /admin/*, /api/*) no pasan por ahí. Encontrado en
 * el primer deploy real a producción, 2026-08-21 — ver
 * docs/superpowers/plans/2026-08-20-nextjs-migracion-familias-plan.md.
 *
 * Mismo contenido que public/_headers (ver ese archivo para el porqué de
 * cada regla de la CSP) — se mantienen los dos en sync a mano; Cache-Control
 * de /assets/*, /productos/*, /Logo/* se queda en _headers porque esos sí
 * son estáticos de verdad (passthrough de Netlify, no pasan por esta función).
 */
const SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://challenges.cloudflare.com https://www.googletagmanager.com https://www.clarity.ms https://*.clarity.ms; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://kyuilrlewynqrzebouww.supabase.co https://nominatim.openstreetmap.org https://challenges.cloudflare.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://*.googletagmanager.com https://*.clarity.ms; frame-src https://maps.google.com https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      { source: '/', headers: SECURITY_HEADERS },
      { source: '/:path*', headers: SECURITY_HEADERS },
    ];
  },
};

module.exports = nextConfig;
