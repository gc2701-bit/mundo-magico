/* Sprint A (dashboard admin) — gate de /admin. Mismo hueco de cobertura ya
 * documentado en admin-catalogo.spec.js/admin-pedidos.spec.js/
 * admin-envios.spec.js: el camino "logueado y admin" no se puede
 * automatizar acá (Turnstile no resuelve en este entorno). El grid de
 * tiles en sí (AdminHomeLauncher) se prueba unitariamente,
 * ver tests/unit/admin-home-launcher.test.tsx.
 */
const { test, expect } = require('@playwright/test');

test('visitante sin sesión ve el gate, nunca los tiles del dashboard', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('.adm-gate')).toBeVisible();
  await expect(page.getByText('Necesitás iniciar sesión')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Catálogo' })).toHaveCount(0);
});

test('el botón "Iniciar sesión" del gate abre el modal de cuenta real', async ({ page }) => {
  await page.goto('/admin');
  await page.locator('.adm-gate').getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('dialog', { name: 'Mi cuenta' })).toHaveCSS('opacity', '1');
});
