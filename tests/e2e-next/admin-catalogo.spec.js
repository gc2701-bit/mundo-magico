/* Sprint 4 (Task 4.7) — gate de /admin/catalogo. El caso "es admin" no se
 * puede automatizar acá: Supabase exige Turnstile en el login y este
 * entorno sandboxeado no resuelve uno de los subdominios de verificación
 * de Cloudflare (challenges.cloudflare.com/.../brunhild...) por DNS — no
 * es un bug del código, es una limitación de red de este entorno
 * (confirmado a mano). El camino "logueado y admin" se verificó en
 * cambio consultando directo Supabase con las mismas queries que
 * ejecutan los botones (ver el resumen de la sesión) — no queda cubierto
 * acá por un e2e real, es un hueco de cobertura conocido.
 */
const { test, expect } = require('@playwright/test');

test('visitante sin sesión ve el gate, nunca el panel', async ({ page }) => {
  await page.goto('/admin/catalogo');
  await expect(page.locator('.adm-gate')).toBeVisible();
  await expect(page.locator('.adm-tabs')).toHaveCount(0);
  await expect(page.getByText('Necesitás iniciar sesión')).toBeVisible();
});
