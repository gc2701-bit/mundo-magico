/* Regresión de un bug real en producción (2026-08-21, ver "Corte a
 * producción" en el plan): Nav.tsx usaba el atributo `hidden` para
 * mostrar/ocultar `.nav-links` en vez de la clase `.open` que espera
 * v2.css — `.nav-links{display:flex}` es la regla de escritorio (siempre
 * visible), sólo `@media(max-width:820px)` la esconde y usa `.open` para
 * mostrarla. El atributo `hidden` fuerza display:none en CUALQUIER ancho
 * de pantalla, con más especificidad que esas reglas — el menú entero
 * quedaba invisible en todo el sitio hasta hacer clic en el hamburguesa
 * (que en escritorio ni siquiera se ve, `.nav-toggle{display:none}` por
 * default). Cero cobertura de test detectó esto — se agrega acá.
 */
const { test, expect } = require('@playwright/test');

test('el menú de navegación se ve en escritorio sin hacer clic en nada', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#nav-links')).toBeVisible();
  await expect(page.locator('#nav-links').getByRole('link', { name: 'Explorar' })).toBeVisible();
  await expect(page.locator('#nav-links').getByText('Nuestros mundos')).toBeVisible();
});

test('el dropdown "Nuestros mundos" lista los mundos reales al pasar el mouse', async ({ page }) => {
  await page.goto('/');
  // .nav-dropdown sólo se muestra en :hover/:focus-within de .nav-item
  // (v2.css línea 174) — no está siempre visible en escritorio.
  await page.locator('.nav-item.has-dropdown').hover();
  const dropdown = page.locator('.nav-dropdown[role="menu"]');
  await expect(dropdown.getByRole('menuitem').first()).toBeVisible();
});

test('en mobile, el menú arranca cerrado y el botón hamburguesa lo abre', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const navLinks = page.locator('#nav-links');
  await expect(navLinks).not.toHaveClass(/open/);
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(navLinks).toHaveClass(/open/);
});
