/* Sprint 5 (Task 5.2) del sitio nuevo en Next.js — carrito de pedidos y
 * visor de pedido compartido. Corre contra un build real (ver
 * playwright.next.config.js).
 *
 * No cubre el envío real a WhatsApp (abre una pestaña nueva, wa.me) ni el
 * guardado en Supabase (necesita sesión real, ver el mismo hallazgo de
 * Turnstile ya documentado en Sprint 4/5.1) — cubre el armado del pedido en
 * el panel: agregar, contador, cantidad, quitar, y el visor de /pedido con
 * un link armado a mano (mismo criterio que pedido.html: el pedido viaja
 * en el link, no en una base de datos).
 */
const { test, expect } = require('@playwright/test');

test('agregar un producto simple lo suma al contador del header y al panel', async ({ page }) => {
  await page.goto('/globos-fiesta');
  const tarjeta = page.locator('a.pcard[data-codigo]').first();
  const titulo = await tarjeta.locator('h3').textContent();

  await tarjeta.locator('.pcard-add').click();

  await expect(page.locator('.cart-nav .cart-n')).toHaveText('1');

  await page.locator('.cart-nav').click();
  await expect(page.locator('.cart-panel')).toHaveClass(/is-on/);
  await expect(page.locator('.cart-panel .cart-item-t').first()).toHaveText(titulo || '');
});

test('el − N + del panel ajusta la cantidad y "Quitar" saca el renglón', async ({ page }) => {
  await page.goto('/globos-fiesta');
  await page.locator('a.pcard[data-codigo]').first().locator('.pcard-add').click();
  await page.locator('.cart-nav').click();

  const paso = page.locator('.cart-panel .cart-item .cart-step').first();
  await paso.locator('.cart-step-b', { hasText: '+' }).click();
  await expect(paso.locator('.cart-step-n')).toHaveText('2');
  await expect(page.locator('.cart-nav .cart-n')).toHaveText('2');

  await page.locator('.cart-panel .cart-del').first().click();
  await expect(page.locator('.cart-panel .cart-empty')).toBeVisible();
  await expect(page.locator('.cart-nav .cart-n')).toHaveText('0');
});

test('el corazón de favoritos se prende y el producto aparece en "Mis favoritos"', async ({ page }) => {
  await page.goto('/globos-fiesta');
  const tarjeta = page.locator('a.pcard[data-codigo]').first();
  const titulo = await tarjeta.locator('h3').textContent();

  await tarjeta.locator('.pcard-fav').click();
  await expect(tarjeta.locator('.pcard-fav')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('.cuenta-nav').click(); // sin sesión: abre el modal de alta, no el popover
  await page.keyboard.press('Escape');
});

test('elegir método de entrega antes de mandar: sin elegir nada, no se puede seguir', async ({ page }) => {
  await page.goto('/globos-fiesta');
  await page.locator('a.pcard[data-codigo]').first().locator('.pcard-add').click();
  await page.locator('.cart-nav').click();

  let mensaje = '';
  page.once('dialog', (dialog) => {
    mensaje = dialog.message();
    dialog.dismiss();
  });
  await page.locator('.cart-panel .cart-send').click();
  await expect.poll(() => mensaje).toMatch(/Elegí si retirás/i);
});

test('elegir "Envío a domicilio" muestra los campos de dirección y zona', async ({ page }) => {
  await page.goto('/globos-fiesta');
  await page.locator('a.pcard[data-codigo]').first().locator('.pcard-add').click();
  await page.locator('.cart-nav').click();

  await page.getByRole('button', { name: 'Envío a domicilio' }).click();
  await expect(page.getByPlaceholder('Calle, número, referencia')).toBeVisible();
});

test('/pedido sin hash muestra el mensaje de "sin pedido"', async ({ page }) => {
  await page.goto('/pedido');
  await expect(page.locator('.ped-bad')).toHaveText(/no tiene ningún pedido/i);
});

test('/pedido con un link armado a mano dibuja el pedido con fotos', async ({ page }) => {
  const payload = { i: [{ t: 'Globo estándar', q: 3, c: '01848', v: 'Blanco' }], e: { nombre: 'Ana', metodoEntrega: 'retiro', sucursalNombre: 'Junín 351' } };
  const hash = await page.evaluate((p) => {
    const b = btoa(unescape(encodeURIComponent(JSON.stringify(p))));
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }, payload);

  await page.goto('/pedido#' + hash);
  await expect(page.locator('#ped-sub')).toHaveText('1 producto(s) · 3 unidad(es) en total');
  await expect(page.locator('.ped-item h3')).toHaveText('Globo estándar');
  await expect(page.locator('.ped-item .ped-code')).toHaveText('01848');
  await expect(page.locator('.ped-meta').first()).toContainText('Retiro en Junín 351');
  await expect(page.locator('.ped-meta').last()).toContainText('Buscá cada código en el sistema'); // bloque "Para confirmar"
});

test('/pedido?vista=cliente esconde el bloque "Para confirmar"', async ({ page }) => {
  const payload = [{ t: 'Globo', q: 1 }];
  const hash = await page.evaluate((p) => {
    const b = btoa(unescape(encodeURIComponent(JSON.stringify(p))));
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }, payload);

  await page.goto('/pedido?vista=cliente#' + hash);
  await expect(page.locator('h1')).toHaveText('Tu pedido');
  await expect(page.locator('.ped-meta')).toHaveCount(0);
});
