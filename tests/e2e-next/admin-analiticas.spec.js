/* Sprint F (dashboard admin) — gate compartido en /admin/analiticas. El
 * camino "logueado y admin" (gráfico + ranking) queda cubierto por
 * tests/unit/admin-analiticas-page.test.tsx — mismo hueco de cobertura ya
 * documentado en el resto de admin-*.spec.js (Turnstile no resuelve en
 * este entorno).
 */
const { test, expect } = require('@playwright/test');

test('visitante sin sesión ve el gate, nunca el gráfico', async ({ page }) => {
  await page.goto('/admin/analiticas');
  await expect(page.locator('.adm-gate')).toBeVisible();
  await expect(page.getByText('Necesitás iniciar sesión')).toBeVisible();
});
