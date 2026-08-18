/* Guardia de regresión: una visita anónima a una página de categoría NUNCA
 * debería pedir ningún archivo del editor de catálogo viejo (retirado en
 * esta tanda a favor de admin-catalogo.html, página dedicada solo-admin —
 * ver SPEC-catalogo-admin.md). admin-catalogo.js/.css ahora SON esa página
 * nueva (cargados solo desde admin-catalogo.html, nunca desde una página
 * de categoría) y admin-bundle-loader.js ya no existe.
 */
const { test, expect } = require('@playwright/test');

test('visitante sin sesión: nunca se pide admin-catalogo.(js|css) ni admin-bundle-loader.js', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort());
  await page.route('**/nominatim.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/challenges.cloudflare.com/**', (route) => route.abort());

  const pedidosAdmin = [];
  page.on('request', (req) => {
    if (/assets\/admin-(catalogo|bundle-loader)\.(js|css)$/.test(req.url())) pedidosAdmin.push(req.url());
  });

  await page.goto('/disfraces-v2.html');
  await page.waitForLoadState('networkidle');

  expect(pedidosAdmin).toEqual([]);
});
