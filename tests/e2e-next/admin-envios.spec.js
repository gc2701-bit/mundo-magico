/* Sprint 5 (Task 5.4) — gate de /admin/envios. Mismo hueco de cobertura ya
 * documentado en admin-catalogo.spec.js/admin-pedidos.spec.js: el camino
 * "logueado y admin" no se puede automatizar acá (Turnstile no resuelve en
 * este entorno).
 */
const { test, expect } = require('@playwright/test');

test('visitante sin sesión ve el gate, nunca el editor', async ({ page }) => {
  await page.goto('/admin/envios');
  await expect(page.locator('.adm-gate')).toBeVisible();
  await expect(page.locator('.adm-cfg-tabs')).toHaveCount(0);
  await expect(page.getByText('Necesitás iniciar sesión')).toBeVisible();
});

test('el botón "Iniciar sesión" del gate abre el modal de cuenta real', async ({ page }) => {
  await page.goto('/admin/envios');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.locator('.cart-acc').first()).toHaveClass(/is-on/);
});
