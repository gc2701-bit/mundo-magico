/* Sprint 5 (Task 5.3) — gate de /admin/pedidos. Mismo hueco de cobertura ya
 * documentado en admin-catalogo.spec.js: el camino "logueado y admin" no se
 * puede automatizar acá (Turnstile no resuelve en este entorno). El panel
 * en sí (listar/agrupar/cambiar estado/avisar) se verificó ejecutando la
 * lógica pura contra Supabase vía MCP, no queda cubierto por un e2e real.
 */
const { test, expect } = require('@playwright/test');

test('visitante sin sesión ve el gate, nunca el panel', async ({ page }) => {
  await page.goto('/admin/pedidos');
  await expect(page.locator('.adm-gate')).toBeVisible();
  await expect(page.locator('.adm-stats')).toHaveCount(0);
  await expect(page.getByText('Necesitás iniciar sesión')).toBeVisible();
});

test('el botón "Iniciar sesión" del gate abre el modal de cuenta real', async ({ page }) => {
  await page.goto('/admin/pedidos');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.locator('.cart-acc').first()).toHaveClass(/is-on/);
});
