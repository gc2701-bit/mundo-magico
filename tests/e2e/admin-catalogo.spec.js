/* admin-catalogo.html — gate admin-vs-no-admin y navegación entre
 * pestañas. El flujo de activación end-to-end contra datos reales de
 * catalogo_buho_espejo NO se cubre acá (necesitaría credenciales de
 * service_role para sembrar datos de prueba en Supabase, fuera de alcance
 * de este repo/CI) — queda cubierto a nivel unitario por
 * admin-catalogo-espejo.test.js (Task 12) y debe verificarse a mano contra
 * el proyecto real una vez aplicadas las migraciones (Tasks 1-3).
 */
const { test, expect } = require('@playwright/test');

test('sin sesión: admin-catalogo.html muestra el gate de login, nunca el panel', async ({ page }) => {
  await page.goto('/admin-catalogo.html');
  await expect(page.locator('#adm-gate')).toBeVisible();
  await expect(page.locator('#adm-panel')).toBeHidden();
  // La cabecera de sesión (mismo markup que admin-pedidos.html) está cableada:
  // sin sesión no muestra ni el "Conectado como" ni el botón de salir.
  await expect(page.locator('#adm-sesion')).toBeHidden();
  await expect(page.locator('#adm-logout-btn')).toBeHidden();
});

test('permalink real: la URL sirve admin-catalogo.html, no admin-catalogo/index.html', async ({ page }) => {
  const res = await page.goto('/admin-catalogo.html');
  expect(res.ok()).toBe(true);
  expect(page.url()).toContain('/admin-catalogo.html');
});
