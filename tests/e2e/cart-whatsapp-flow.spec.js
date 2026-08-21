/* Flujo real de punta a punta: navegar una categoría → agregar un producto
 * al pedido → abrir el panel → mandarlo por WhatsApp. Es el único camino de
 * conversión que existe hoy en el sitio (no hay checkout propio, ver
 * mundo-magico/CLAUDE.md) — si esto se rompe, el negocio deja de recibir
 * pedidos.
 *
 * Se bloquean Supabase y Nominatim a propósito (ver `page.route` abajo): el
 * carrito y el envío del pedido no deberían depender de que la base esté
 * arriba ni de pegarle a la producción real desde un test. El catálogo cae
 * solo al respaldo estático (assets/precios-datos.js) — es exactamente la
 * cascada que prueba tests/unit/catalogo.test.js, acá se comprueba que el
 * resto de la página se banca ese escenario sin romperse.
 */
const { test, expect } = require('@playwright/test');

async function bloquearRedExterna(page) {
  await page.route('**/*.supabase.co/**', (route) => route.abort());
  await page.route('**/nominatim.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/challenges.cloudflare.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
}

test.describe('Carrito → WhatsApp', () => {
  test('agregar un producto simple al pedido y llegar hasta la puerta de cuenta antes de WhatsApp', async ({ page }) => {
    await bloquearRedExterna(page);
    await page.goto('/disfraces-v2.html');

    // Tarjeta data-pos="39073" ("Alas mariposa tornasolada"):
    // data-specs="Tornasolada" (un solo valor, sin el prefijo "Colores:") y
    // sin has-gallery — es el caso realmente simple. Ojo: NO alcanza con "sin
    // has-gallery" para asumir simple — una tarjeta con "Colores: a, b, c" en
    // data-specs igual arma opciones de texto y abre el selector aunque no
    // tenga galería de fotos (ver assets/producto.js ~L120). Se localiza por
    // data-pos, no por texto: el <h3> y el <span class="sub"> son nodos
    // separados sin espacio entre sí, así que el texto visible concatenado
    // NO contiene "Alas mariposa tornasolada" como substring — y el título
    // que termina en el carrito (assets/producto.js `titulo()`) es solo el
    // <h3>, "Alas mariposa", sin el color.
    const card = page.locator('a.pcard[data-pos="39073"]').first();
    await expect(card).toBeVisible();
    await card.locator('.pcard-add').click();

    // El contador del carrito (barra de navegación) refleja el alta.
    const contador = page.locator('.cart-nav .cart-n').first();
    await expect(contador).toHaveText('1');

    // Abrir el panel del pedido y confirmar el renglón.
    await page.locator('.cart-nav').click();
    const panel = page.locator('.cart-panel.is-on');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.cart-item-t', { hasText: 'Alas mariposa' })).toBeVisible();

    // Mandar el pedido por WhatsApp pide cuenta primero (ver cabecera de
    // assets/cuenta.js: "el único punto que pide iniciar sesión es
    // carrito.js justo antes de mandar el pedido"). Probar el envío real a
    // wa.me de punta a punta necesitaría además simular un login contra
    // Supabase Auth — fuera del alcance de este test (ver hueco anotado en
    // el reporte de cobertura). Lo que sí se prueba acá, de verdad, es que
    // la puerta de cuenta se activa en el momento correcto: recién al
    // intentar enviar, nunca antes, y nunca al sólo mirar el catálogo.
    await panel.locator('.cart-send', { hasText: 'Enviar pedido por WhatsApp' }).click();
    await expect(page.locator('.cart-acc.is-on')).toBeVisible();
    await expect(page.locator('.cart-acc.is-on')).toContainText('cuenta');
  });

  test('un producto con variantes obligatorias abre el selector de colores/talles antes de agregar', async ({ page }) => {
    await bloquearRedExterna(page);
    await page.goto('/disfraces-v2.html');

    // "Alas mariposa lunares" tiene galería (multicolor/violeta) sin
    // data-pos único a nivel tarjeta: elegir es obligatorio (ver comentario
    // de cabecera de assets/carrito.js).
    const card = page.locator('a.pcard', { hasText: 'Alas mariposa lunares' }).first();
    await expect(card).toBeVisible();
    await card.locator('.pcard-add').click();

    // El <h2> del diálogo arranca en "Elegí colores y cantidades"
    // (armarPicker(), assets/carrito.js) pero se pisa con el título del
    // producto en cuanto se abre para uno — se verifica el texto que sí
    // queda: el aria-label (fijo, nunca se pisa) y el pie del selector.
    await expect(page.locator('.cart-pick.is-on')).toBeVisible();
    await expect(page.locator('.cart-pick.is-on')).toHaveAttribute('aria-label', 'Elegir colores y cantidades');
    await expect(page.locator('.cart-pick.is-on')).toContainText('Elegí cuántos querés de cada color.');
  });
});
