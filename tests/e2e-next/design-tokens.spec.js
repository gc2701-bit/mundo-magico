/* Sprint 0 del rediseño de frontend (ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md):
 * verifica en un navegador real que Tailwind + shadcn/ui quedaron
 * correctamente themeados con los tokens de assets/v2.css — algo que un
 * test de jsdom no puede confirmar (colores/contraste reales solo existen
 * con CSS aplicado de verdad). También confirma que el sitio viejo
 * (home) no se rompió al agregar Tailwind — el riesgo real anotado en
 * app/globals.css.
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test('la página de verificación de tokens carga con la paleta de marca aplicada', async ({ page }) => {
  await page.goto('/design-preview');
  const fondo = await page.evaluate(() => getComputedStyle(document.querySelector('main')).backgroundColor);
  // --color-background: #fdfbf5 → rgb(253, 251, 245). El <main> hereda de
  // body, que trae bg-background por el @layer base de shadcn.
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBg).toBe('rgb(253, 251, 245)');

  const boton = page.getByRole('button', { name: 'Agregar al carrito' });
  await expect(boton).toBeVisible();
  const botonBg = await boton.evaluate((el) => getComputedStyle(el).backgroundColor);
  // --primary: #1e8834 (verde de marca) → rgb(30, 136, 52)
  expect(botonBg).toBe('rgb(30, 136, 52)');
});

test('el detalle de producto usa Fraunces itálica, no un font-family aparte (Caveat)', async ({ page }) => {
  await page.goto('/design-preview');
  const detalle = page.getByText('Fraunces itálica — detalle', { exact: false });
  const estilo = await detalle.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { family: cs.fontFamily, style: cs.fontStyle };
  });
  expect(estilo.family.toLowerCase()).toContain('fraunces');
  expect(estilo.family.toLowerCase()).not.toContain('caveat');
  expect(estilo.style).toBe('italic');
});

test('contraste WCAG AA en la página de tokens (axe-core)', async ({ page }) => {
  await page.goto('/design-preview');
  const resultados = await new AxeBuilder({ page })
    .withTags(['wcag2aa'])
    .analyze();
  const contraste = resultados.violations.filter((v) => v.id === 'color-contrast');
  expect(contraste, JSON.stringify(contraste, null, 2)).toEqual([]);
});

test('el home viejo sigue sirviendo contenido real — Tailwind no rompió el sitio existente', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#nav-links')).toBeVisible();
});
