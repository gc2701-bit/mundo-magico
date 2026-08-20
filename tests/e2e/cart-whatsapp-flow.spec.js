/* Flujo real de punta a punta: navegar una categoría → agregar un producto
 * al pedido → abrir el panel → mandarlo por WhatsApp. Es el único camino de
 * conversión que existe hoy en el sitio (no hay checkout propio, ver
 * mundo-magico/CLAUDE.md) — si esto se rompe, el negocio deja de recibir
 * pedidos.
 *
 * Nominatim/Turnstile/Analytics se siguen bloqueando (no hacen falta para
 * este flujo). Supabase YA NO se bloquea: desde la migración a Next.js
 * (Sprint 1, ver docs/superpowers/plans/2026-08-20-nextjs-migracion-familias-plan.md)
 * los dos productos de ejemplo de este archivo son filas de
 * catalogo_productos (antes eran tarjetas escritas a mano en el HTML con
 * respaldo estático si Supabase caía) — ya no existe ningún producto
 * "simple" que siga siendo HTML puro, así que probar el camino sin red
 * dejó de ser posible con estos ejemplos. Es un hueco de cobertura
 * temporal y aceptado (decisión con el usuario, 2026-08-20): las páginas
 * de familia del sitio nuevo (Sprint 2+, con ISR) van a ser MÁS
 * resilientes que esto de todos modos — sirven la última versión generada
 * aunque Supabase esté caída en el momento de la visita.
 *
 * `mm_bienvenida_v1` precargado en localStorage: es el flag de "primera
 * visita" de assets/cuenta.js — sin él, un visitante sin sesión ve un
 * modal de bienvenida a los 1.5s (gateado por el chequeo de sesión de
 * Supabase, que antes nunca se resolvía porque este test bloqueaba
 * Supabase). No es un bug: se confirmó que el modal se comporta bien y
 * desaparece solo para cualquiera que ya visitó el sitio — acá se precarga
 * el flag para probar el flujo de carrito de un visitante recurrente, sin
 * que un modal no relacionado tape la tarjeta.
 *
 * El primer test ("...antes de WhatsApp") queda `test.fixme()`: con
 * Supabase real, el paso final (click en "Enviar pedido" debería abrir
 * `.cart-acc`, la puerta de cuenta) es flaky — parece timing de
 * `MMCuenta.sesionActiva()` contra el `getSession()` real de Supabase Auth,
 * no algo específico de esta migración. No se investigó más a fondo para
 * no desviarse de la migración en curso (decisión con el usuario,
 * 2026-08-20) — el segundo test (selector de colores/talles) sí quedó en
 * verde con Supabase real.
 */
const { test, expect } = require('@playwright/test');

async function bloquearRedExterna(page) {
  await page.route('**/nominatim.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/challenges.cloudflare.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem('mm_bienvenida_v1', '1'));
}

test.describe('Carrito → WhatsApp', () => {
  test.fixme('agregar un producto simple al pedido y llegar hasta la puerta de cuenta antes de WhatsApp', async ({ page }) => {
    await bloquearRedExterna(page);
    await page.goto('/disfraces-v2.html');
    await page.waitForLoadState('networkidle');

    // "Alas mariposa" (catalogo_productos, código 39073) — antes tarjeta
    // del HTML, migrada en el Sprint 1. Se localiza por data-pos: el <h3>
    // y el <span class="sub"> son nodos separados sin espacio entre sí,
    // así que el texto visible concatenado no arma "Alas mariposa
    // tornasolada" como substring — y el título que termina en el
    // carrito (assets/producto.js `titulo()`) es solo el <h3>, "Alas
    // mariposa", sin el color.
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
    await page.waitForLoadState('networkidle');

    // "Alas mariposa de lentejuelas" (catalogo_productos, ya existía antes
    // del Sprint 1 — no es la "Alas mariposa lunares" que este test usaba
    // antes: esa quedó publicado=false, oculta desde el panel de admin
    // desde antes de la migración, nunca debería aparecer). Tiene galería
    // de 3 colores sin código único a nivel tarjeta: elegir es obligatorio
    // (ver comentario de cabecera de assets/carrito.js).
    const card = page.locator('a.pcard', { hasText: 'Alas mariposa de lentejuelas' }).first();
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
