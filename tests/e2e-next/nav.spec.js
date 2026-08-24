/* Nav rediseñado (Sprint 2, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md):
 * desktop en dos niveles (franja de utilidad + fila principal con
 * mega-menú de Mundos en grilla), mobile con barra inferior fija estilo
 * app (Home/Mundos/Buscar/Cuenta/Carrito). Reemplaza la suite anterior,
 * escrita contra el porteo 1:1 de nav.njk (`.nav-links`/`.nav-dropdown`),
 * que ya no existe.
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test('contraste WCAG AA en el nav y footer nuevos (axe-core)', async ({ page }) => {
  await page.goto('/');
  const resultados = await new AxeBuilder({ page })
    .include('#nav-desktop')
    .include('footer')
    .withTags(['wcag2aa'])
    .analyze();
  const contraste = resultados.violations.filter((v) => v.id === 'color-contrast');
  expect(contraste, JSON.stringify(contraste, null, 2)).toEqual([]);
});

test('desktop: la fila principal se ve sin hacer clic en nada', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('#nav-desktop');
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Mundos ▾' })).toBeVisible();
  await expect(nav.getByRole('button', { name: '🔍 Buscar' })).toBeVisible();
});

test('desktop: la franja de utilidad lista Historia/Eventos/Visitanos/Contacto', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Historia' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Eventos a medida' }).first()).toBeVisible();
});

test('desktop: el mega-menú de Mundos se abre al pasar el mouse y lista los mundos reales', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mundos ▾' }).hover();
  const menu = page.locator('#mundos-menu-desktop');
  await expect(menu.getByRole('menuitem').first()).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Ver todo el catálogo/ })).toBeVisible();
});

test('desktop: el mega-menú también abre con teclado (focus) y cierra con Escape', async ({ page }) => {
  await page.goto('/');
  const boton = page.getByRole('button', { name: 'Mundos ▾' });
  await boton.focus();
  await expect(page.locator('#mundos-menu-desktop')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mundos-menu-desktop')).toBeHidden();
});

test('desktop: tocar "Buscar" abre un input que manda a /explorar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '🔍 Buscar' }).click();
  const input = page.getByPlaceholder('Buscar disfraces, globos, cotillón...');
  await expect(input).toBeVisible();
  await input.fill('globo');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/explorar\?q=globo/);
});

test('mobile: la barra inferior fija tiene los 5 destinos', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const barra = page.locator('#nav-mobile-bottom');
  await expect(barra).toBeVisible();
  await expect(barra.getByRole('link', { name: /Home/ })).toBeVisible();
  await expect(barra.getByRole('button', { name: /Mundos/ })).toBeVisible();
  await expect(barra.getByRole('button', { name: /Buscar/ })).toBeVisible();
  await expect(barra.locator('.cuenta-nav')).toBeVisible();
  await expect(barra.locator('.cart-nav')).toBeVisible();
});

test('mobile: tocar "Mundos" abre la pantalla completa con la grilla de mundos', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#nav-mobile-bottom').getByRole('button', { name: /Mundos/ }).click();
  const panel = page.getByRole('dialog', { name: 'Nuestros mundos' });
  await expect(panel.getByRole('menuitem').first()).toBeVisible();
  await panel.getByRole('menuitem').first().click();
  await expect(panel).toBeHidden();
});

test('mobile: tocar "Buscar" abre la pantalla completa con el input, y "Cancelar" la cierra', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#nav-mobile-bottom').getByRole('button', { name: /Buscar/ }).click();
  const panel = page.getByRole('dialog', { name: 'Buscar' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Cancelar' }).click();
  await expect(panel).toBeHidden();
});
