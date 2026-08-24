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
 *
 * `.first()` en los locators de .cart-nav/.cuenta-nav: desde Sprint 2 del
 * rediseño de frontend, Nav.tsx renderiza CarritoNavButton/CuentaNavButton
 * dos veces en el DOM (fila de escritorio + barra inferior de mobile,
 * mostradas/ocultadas por CSS) — sin `.first()`, Playwright tira "strict
 * mode violation" por encontrar dos coincidencias.
 *
 * Sprint 7: el panel se abre solo al agregar (antes había que tocar el
 * ícono del carrito a mano después) — los tests ya no clickean
 * `.cart-nav` para abrirlo. `CarritoPanel.tsx` se reescribió con
 * Tailwind (dejó de tener clases `cart-*`): estos tests usan role/texto
 * en vez de esas clases viejas. `CarritoNavButton`/`.cart-nav` en sí NO
 * se tocó este sprint (sigue con su estilo legacy) — ver ese componente
 * si hace falta actualizar esos locators en otro momento.
 */
const { test, expect } = require('@playwright/test');

test('agregar un producto simple lo suma al contador del header y abre el panel solo', async ({ page }) => {
  await page.goto('/globos-fiesta');
  const tarjeta = page.locator('a.pcard[data-codigo]').first();
  const titulo = await tarjeta.locator('h3').textContent();

  await tarjeta.locator('.pcard-add').click();

  await expect(page.locator('.cart-nav .cart-n').first()).toHaveText('1');

  const panel = page.getByRole('dialog', { name: 'Mi pedido' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText(titulo || '')).toBeVisible();
});

test('el − N + del panel ajusta la cantidad y "Quitar" saca el renglón', async ({ page }) => {
  await page.goto('/globos-fiesta');
  await page.locator('a.pcard[data-codigo]').first().locator('.pcard-add').click();

  const panel = page.getByRole('dialog', { name: 'Mi pedido' });
  await panel.getByRole('button', { name: /^Agregar uno de/ }).click();
  await expect(panel.getByText('2', { exact: true })).toBeVisible();
  await expect(page.locator('.cart-nav .cart-n').first()).toHaveText('2');

  await panel.getByRole('button', { name: 'Quitar', exact: true }).click();
  await expect(panel.getByText('Todavía no agregaste nada')).toBeVisible();
  await expect(page.locator('.cart-nav .cart-n').first()).toHaveText('0');
});

test('el corazón de favoritos se prende y el producto aparece en "Mis favoritos"', async ({ page }) => {
  await page.goto('/globos-fiesta');
  const tarjeta = page.locator('a.pcard[data-codigo]').first();
  const titulo = await tarjeta.locator('h3').textContent();

  await tarjeta.locator('.pcard-fav').click();
  await expect(tarjeta.locator('.pcard-fav')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('.cuenta-nav').first().click(); // sin sesión: abre el modal de alta, no el popover
  await page.keyboard.press('Escape');
});

test('elegir método de entrega antes de mandar: sin elegir nada, no se puede seguir', async ({ page }) => {
  await page.goto('/globos-fiesta');
  await page.locator('a.pcard[data-codigo]').first().locator('.pcard-add').click();

  let mensaje = '';
  page.once('dialog', (dialog) => {
    mensaje = dialog.message();
    dialog.dismiss();
  });
  await page.getByRole('dialog', { name: 'Mi pedido' }).getByRole('button', { name: /Enviar pedido/ }).click();
  await expect.poll(() => mensaje).toMatch(/Elegí si retirás/i);
});

test('elegir "Envío a domicilio" muestra los campos de dirección y zona', async ({ page }) => {
  await page.goto('/globos-fiesta');
  await page.locator('a.pcard[data-codigo]').first().locator('.pcard-add').click();

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
