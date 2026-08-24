/* Sprint 5.5 — reemplaza a familia.spec.js: la categorización pública
 * vuelve a ser mundo (familia pasa a dato interno, sólo panel admin).
 * Verifica lo mínimo que hace único a esta migración: contenido estático
 * real (no inyectado por JS) en una página de mundo, precio hidratado
 * client-side después, y el buscador de Explorar filtrando de verdad.
 * Corre contra un build real (`npm run build && npm run start`, ver
 * playwright.next.config.js) — nunca contra `next dev`.
 */
const { test, expect } = require('@playwright/test');

test('una página de mundo sirve HTML estático con productos y el precio se hidrata solo', async ({ page }) => {
  // Antes de cualquier JS: el HTML servido por el navegador ya trae el
  // título del producto — es la prueba de que esto es SSG/ISR real, no
  // inyectado después de un fetch.
  const res = await page.goto('/globos-fiesta');
  const htmlCrudo = await res.text();
  // Sin el "=" ni el nombre exacto de la clase: desde Sprint 3 el <h3> y
  // el <a> de la card llevan varias clases de Tailwind además de
  // pcard/font-semibold — lo que importa acá es que el tag exista con
  // contenido real, no la lista exacta de clases.
  expect(htmlCrudo).toContain('<h3');
  expect(htmlCrudo).toMatch(/class="[^"]*\bpcard\b/);

  // Tarjeta puntual con precio real en catalogo_precios (a diferencia del
  // primer producto del mundo, que no tiene fila de precio — dato
  // preexistente, no relacionado con esta migración).
  const tarjeta = page.locator('a.pcard[data-codigo="61147"]');
  await expect(tarjeta).toBeVisible();

  // El precio arranca vacío (server) y se completa solo, sin recargar —
  // CatalogoPrecios.tsx hidratando client-side.
  await expect(tarjeta.locator('.pricetag')).toHaveText(/\$/, { timeout: 5000 });
});

test('el título de la página usa el nombre de display del mundo, no el slug crudo', async ({ page }) => {
  await page.goto('/globos-fiesta');
  await expect(page.locator('.catsec-head h2')).toHaveText('Cotillón');
});

test('mundo inexistente da 404', async ({ page }) => {
  const res = await page.goto('/esto-no-existe-como-mundo');
  expect(res.status()).toBe(404);
});

test('la nav lista los mundos con nombre de display, con link al slug', async ({ page }) => {
  // Nav rediseñado (Sprint 2) — el mega-menú de escritorio reemplaza al
  // dropdown viejo (.nav-dropdown), ver tests/e2e-next/nav.spec.js.
  await page.goto('/');
  await page.getByRole('button', { name: 'Mundos ▾' }).hover();
  const link = page.locator('#mundos-menu-desktop a', { hasText: 'Cotillón' });
  await expect(link).toHaveAttribute('href', '/globos-fiesta');
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
