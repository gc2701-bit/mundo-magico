/* Ficha de producto (Sprint 7, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md).
 * Corre contra un build real (`npm run build && npm run start`, ver
 * playwright.next.config.js) — nunca contra `next dev`.
 */
const { test, expect } = require('@playwright/test');

test('sirve HTML estático real y el precio se hidrata solo', async ({ page }) => {
  const res = await page.goto('/globos-fiesta/collares-y-vinchas-hawaianas');
  const htmlCrudo = await res.text();
  expect(htmlCrudo).toContain('Collares y vinchas hawaianas');

  await expect(page.getByRole('heading', { level: 1, name: 'Collares y vinchas hawaianas' })).toBeVisible();
  await expect(page.locator('nav[aria-label="Ruta de navegación"]')).toContainText('Cotillón');
  await expect(page.locator('.pricetag').first()).toHaveText(/\$/, { timeout: 5000 });
});

test('slug válido en el mundo equivocado da 404', async ({ page }) => {
  const res = await page.goto('/cumpleanos/collares-y-vinchas-hawaianas');
  expect(res.status()).toBe(404);
});

test('galería: tocar una miniatura cambia la foto principal', async ({ page }) => {
  await page.goto('/cumpleanos/globo-estandar-12-x25');
  const miniaturas = page.getByRole('tab');
  await expect(miniaturas.first()).toBeVisible();

  const segundaMiniatura = miniaturas.nth(1);
  await segundaMiniatura.click();
  await expect(segundaMiniatura).toHaveAttribute('aria-selected', 'true');
});

test('producto con talles: elegir uno lo agrega y abre el mini-carrito', async ({ page }) => {
  await page.goto('/globos-fiesta/collares-y-vinchas-hawaianas');

  await page.getByText('Elegí un talle:').scrollIntoViewIfNeeded();
  const primerMas = page.locator('#elegir-talle').getByRole('button', { name: 'Agregar uno' }).first();
  await primerMas.click();

  const panel = page.getByRole('dialog', { name: 'Mi pedido' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Collares y vinchas hawaianas')).toBeVisible();
});

test('el corazón de favoritos de la ficha se prende', async ({ page }) => {
  await page.goto('/globos-fiesta/collares-y-vinchas-hawaianas');
  // .first(): "También te puede interesar" más abajo también tiene sus
  // propios corazones de card (mismo aria-label) — el de la ficha es el
  // primero en el DOM.
  const fav = page.getByRole('button', { name: 'Agregar a favoritos' }).first();
  await fav.click();
  await expect(page.getByRole('button', { name: 'Sacar de favoritos' }).first()).toHaveAttribute('aria-pressed', 'true');
});

test('"También te puede interesar" muestra productos del mismo mundo con links reales', async ({ page }) => {
  await page.goto('/globos-fiesta/collares-y-vinchas-hawaianas');
  const relacionados = page.getByRole('region', { name: 'También te puede interesar' });
  await expect(relacionados).toBeVisible();
  const primerLink = relacionados.locator('a.pcard').first();
  const href = await primerLink.getAttribute('href');
  expect(href).toMatch(/^\/globos-fiesta\//);
});

test('una card del catálogo navega a la ficha de producto real', async ({ page }) => {
  await page.goto('/globos-fiesta');
  const tarjeta = page.locator('a.pcard').first();
  const href = await tarjeta.getAttribute('href');
  expect(href).toMatch(/^\/globos-fiesta\//);
  await tarjeta.click();
  await expect(page).toHaveURL(href);
  await expect(page.locator('nav[aria-label="Ruta de navegación"]')).toBeVisible();
});
