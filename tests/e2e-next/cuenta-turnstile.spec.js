/* Bug real reportado por el usuario (2026-08-25): el login/alta/recuperar
 * del modal de cuenta (CuentaModal.tsx, montado site-wide vía
 * CuentaOverlays en app/layout.tsx) nunca deja completar el captcha —
 * useTurnstile() espera a que exista window.turnstile, pero el script de
 * Cloudflare Turnstile sólo se cargaba en app/admin/layout.tsx, scopeado a
 * /admin/*. En cualquier otra página (home, un mundo, un producto — donde
 * vive el ícono "Mi cuenta" del Nav) el widget nunca aparecía y el submit
 * quedaba trabado en "Esperá un instante (verificación anti-robots)".
 *
 * Este test no depende de que el challenge de Cloudflare resuelva de
 * verdad (ver el comentario de admin-catalogo.spec.js sobre el DNS de
 * challenges.cloudflare.com en este entorno sandboxeado) — sólo confirma
 * que el <script> que define window.turnstile esté presente en CUALQUIER
 * página del sitio, no sólo bajo /admin/*.
 */
const { test, expect } = require('@playwright/test');

test('el script de Cloudflare Turnstile se carga en el home (no sólo bajo /admin/*)', async ({ page }) => {
  await page.goto('/');
  const script = page.locator('script[src*="challenges.cloudflare.com/turnstile"]');
  await expect(script).toHaveCount(1);
});

test('el script de Cloudflare Turnstile sigue cargando en /admin/catalogo (sin duplicarse)', async ({ page }) => {
  await page.goto('/admin/catalogo');
  const script = page.locator('script[src*="challenges.cloudflare.com/turnstile"]');
  await expect(script).toHaveCount(1);
});
