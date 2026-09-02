/* Sprint D (dashboard admin) — gate compartido en /admin/usuarios. El
 * camino "logueado y admin" (tabs Administradores/Clientes) queda cubierto
 * por tests/unit/tab-administradores.test.tsx y
 * tests/unit/tab-clientes-ficha.test.tsx — mismo hueco de cobertura ya
 * documentado en el resto de admin-*.spec.js (Turnstile no resuelve en
 * este entorno).
 */
const { test, expect } = require('@playwright/test');

test('visitante sin sesión ve el gate, nunca las tabs', async ({ page }) => {
  await page.goto('/admin/usuarios');
  await expect(page.locator('.adm-gate')).toBeVisible();
  await expect(page.getByText('Necesitás iniciar sesión')).toBeVisible();
});
