/* Búsqueda predictiva del Nav (Sprint 6, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md).
 * Corre contra un build real (`npm run build && npm run start`, ver
 * playwright.next.config.js) — nunca contra `next dev`.
 */
const { test, expect } = require('@playwright/test');

test('desktop: tipear muestra resultados en vivo y click en uno navega al mundo correcto', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '🔍 Buscar' }).click();

  const input = page.getByPlaceholder('Buscar disfraces, globos, cotillón...');
  await input.fill('anteojo');

  const resultados = page.getByRole('list', { name: 'Resultados de búsqueda' });
  const primerResultado = resultados.getByRole('link').first();
  await expect(primerResultado).toBeVisible({ timeout: 5000 });

  const href = await primerResultado.getAttribute('href');
  await primerResultado.click();
  await expect(page).toHaveURL(href);
});

test('desktop: sin resultados muestra el mensaje, no una grilla vacía', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '🔍 Buscar' }).click();

  const input = page.getByPlaceholder('Buscar disfraces, globos, cotillón...');
  await input.fill('zzzxxqqnoexiste');

  await expect(page.getByText(/Sin resultados para/i)).toBeVisible({ timeout: 5000 });
});

test('desktop: "Ver todos los resultados" manda a /explorar?q= con la búsqueda ya aplicada', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '🔍 Buscar' }).click();

  const input = page.getByPlaceholder('Buscar disfraces, globos, cotillón...');
  await input.fill('anteojo');
  await expect(page.getByText(/Ver todos los resultados/i)).toBeVisible({ timeout: 5000 });
  await page.getByText(/Ver todos los resultados/i).click();

  await expect(page).toHaveURL(/\/explorar\?q=anteojo/);
  await expect(page.getByText('Resultados para "anteojo"')).toBeVisible();
  await expect(page.locator('a.pcard').first()).toBeVisible();
});

test('/explorar?q= directo también corre la búsqueda y "Ver catálogo completo" la limpia', async ({ page }) => {
  await page.goto('/explorar?q=anteojo');
  await expect(page.getByText('Resultados para "anteojo"')).toBeVisible();
  await expect(page.locator('a.pcard').first()).toBeVisible();

  await page.getByRole('button', { name: 'Ver catálogo completo' }).click();
  await expect(page.getByText('Resultados para "anteojo"')).toBeHidden();
  await expect(page).toHaveURL('/explorar');
});

test('mobile: tipear muestra resultados en la pantalla completa', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#nav-mobile-bottom').getByRole('button', { name: /Buscar/ }).click();

  const panel = page.getByRole('dialog', { name: 'Buscar' });
  await panel.getByPlaceholder('Buscar disfraces, globos, cotillón...').fill('anteojo');

  await expect(panel.getByText(/Ver todos los resultados/i)).toBeVisible({ timeout: 5000 });
});
