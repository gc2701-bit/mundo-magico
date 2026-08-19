/* Sanity check mínimo: el sitio arranca de verdad en un navegador servido
 * por node .claude/static-server.js (el mismo server que se usa para
 * verificar en local, ver mundo-magico/CLAUDE.md — "Verificar en servidor
 * local, no abriendo el HTML directo"). Si esto falla, ningún otro test de
 * tests/e2e/ tiene chance de decir algo útil.
 */
const { test, expect } = require('@playwright/test');

test('index.html carga y muestra el título del sitio', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort());
  await page.goto('/index.html');
  await expect(page).toHaveTitle(/Mundo Mágico/i);
  await expect(page.locator('.nav')).toBeVisible();
});
