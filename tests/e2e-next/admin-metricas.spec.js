/* Sprint B (dashboard admin) — gate compartido en /admin/metricas. El
 * camino "logueado y admin" (números reales) queda cubierto por
 * tests/unit/admin-metricas-page.test.tsx — mismo hueco de cobertura ya
 * documentado en el resto de admin-*.spec.js (Turnstile no resuelve en
 * este entorno).
 */
const { test, expect } = require('@playwright/test');

test('visitante sin sesión ve el gate, nunca las tarjetas', async ({ page }) => {
  await page.goto('/admin/metricas');
  await expect(page.locator('.adm-gate')).toBeVisible();
  await expect(page.getByText('Necesitás iniciar sesión')).toBeVisible();
});
