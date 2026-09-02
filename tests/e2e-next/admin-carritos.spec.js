/* Sprint E (dashboard admin) — gate compartido en /admin/carritos. El
 * camino "logueado y admin" (resumen + lista de abandonados) queda
 * cubierto por tests/unit/admin-carritos-page.test.tsx — mismo hueco de
 * cobertura ya documentado en el resto de admin-*.spec.js (Turnstile no
 * resuelve en este entorno).
 */
const { test, expect } = require('@playwright/test');

test('visitante sin sesión ve el gate, nunca el resumen de carritos', async ({ page }) => {
  await page.goto('/admin/carritos');
  await expect(page.locator('.adm-gate')).toBeVisible();
  await expect(page.getByText('Necesitás iniciar sesión')).toBeVisible();
});
