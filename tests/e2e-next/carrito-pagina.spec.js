/* Página /carrito completa (Sprint 8, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md) —
 * distinta del mini-carrito (carrito.spec.js) y de /pedido (visor de
 * sólo lectura, ver carrito.spec.js también). Corre contra un build
 * real (`npm run build && npm run start`, ver playwright.next.config.js).
 */
const { test, expect } = require('@playwright/test');

test('carrito vacío muestra el estado vacío con CTA a los mundos', async ({ page }) => {
  await page.goto('/carrito');
  // Scope a <main>: el mini-carrito (CarritoPanel) sigue montado fuera de
  // pantalla en toda página (Sprint 7) y también muestra este mismo texto
  // cuando está vacío.
  const main = page.getByRole('main');
  await expect(main.getByText('Todavía no agregaste nada')).toBeVisible();
  await expect(main.getByRole('link', { name: 'Ver mundos' })).toHaveAttribute('href', '/explorar');
});

test('agregar un producto y entrar por "Ver mi carrito" lo muestra en /carrito, con cantidad editable', async ({ page }) => {
  await page.goto('/globos-fiesta');
  const tarjeta = page.locator('a.pcard[data-codigo]').first();
  const titulo = await tarjeta.locator('h3').textContent();
  await tarjeta.locator('.pcard-add').click();

  await page.getByRole('dialog', { name: 'Mi pedido' }).getByRole('link', { name: 'Ver mi carrito' }).click();
  await expect(page).toHaveURL('/carrito');
  const main = page.getByRole('main');
  await expect(main.getByText(titulo || '')).toBeVisible();

  await main.getByRole('button', { name: /^Agregar uno de/ }).click();
  await expect(main.getByText('2', { exact: true })).toBeVisible();
});

test('"Continuar compra" sin elegir método de entrega no deja seguir', async ({ page }) => {
  await page.goto('/globos-fiesta');
  await page.locator('a.pcard[data-codigo]').first().locator('.pcard-add').click();
  await page.goto('/carrito');

  let mensaje = '';
  page.once('dialog', (dialog) => {
    mensaje = dialog.message();
    dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Continuar compra' }).click();
  await expect.poll(() => mensaje).toMatch(/Elegí si retirás/i);
});
