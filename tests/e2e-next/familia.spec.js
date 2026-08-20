/* Sprint 2 (Task 2.6) del sitio nuevo en Next.js — verifica lo mínimo que
 * hace único a esta migración: contenido estático real (no inyectado por
 * JS) en una página de familia, precio hidratado client-side después, y
 * el buscador de Explorar filtrando de verdad. Corre contra un build real
 * (`npm run build && npm run start`, ver playwright.next.config.js) —
 * nunca contra `next dev`.
 */
const { test, expect } = require('@playwright/test');

test('una página de familia sirve HTML estático con productos y el precio se hidrata solo', async ({ page }) => {
  // Antes de cualquier JS: el HTML servido por el navegador ya trae el
  // título del producto — es la prueba de que esto es SSG/ISR real, no
  // el viejo catalogo-productos.js inyectando después de un fetch.
  const res = await page.goto('/luminosos');
  const htmlCrudo = await res.text();
  expect(htmlCrudo).toContain('<h3>');
  expect(htmlCrudo).toMatch(/class="pcard"/);

  const primeraTarjeta = page.locator('a.pcard[data-codigo]').first();
  await expect(primeraTarjeta).toBeVisible();

  // El precio arranca vacío (server) y se completa solo, sin recargar —
  // CatalogoPrecios.tsx hidratando client-side.
  await expect(primeraTarjeta.locator('.pricetag')).toHaveText(/\$/, { timeout: 5000 });
});

test('familia inexistente da 404', async ({ page }) => {
  const res = await page.goto('/esto-no-existe-como-familia');
  expect(res.status()).toBe(404);
});

test('Explorar: el buscador filtra la grilla sin recargar la página', async ({ page }) => {
  await page.goto('/explorar');
  const contadorInicial = await page.locator('[aria-live="polite"]').textContent();

  await page.getByPlaceholder('Buscar productos').fill('globo');
  await expect(page.locator('[aria-live="polite"]')).not.toHaveText(contadorInicial || '');

  const cards = page.locator('a.pcard');
  const total = await cards.count();
  expect(total).toBeGreaterThan(0);
  await expect(cards.first().locator('h3')).toContainText(/globo/i);
});
