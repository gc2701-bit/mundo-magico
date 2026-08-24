/* Home rediseñada (Sprint 4, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md):
 * hero compacto + carrusel de destacados, 5 vidrieras de mundo, después
 * el resto de las secciones sin cambios (mundos, banda-especial,
 * confianza, visitanos, reseñas, historia, contacto).
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test('el orden de las secciones es el acordado: hero, vidrieras, resto', async ({ page }) => {
  await page.goto('/');
  const ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll('header#inicio, section[aria-labelledby^="vidriera-"], section.mundos, section.banda-especial, section.trust, section.visitanos, section.resenas, section.historia, section.contacto'))
      .map((el) => el.id || el.getAttribute('aria-labelledby') || el.className)
  );
  const vidrieraIdx = ids.findIndex((c) => String(c).includes('vidriera-cumpleanos'));
  const historiaIdx = ids.indexOf('historia');
  const resenasIdx = ids.findIndex((c) => String(c).includes('resenas'));
  const contactoIdx = ids.indexOf('contacto');

  expect(ids[0]).toBe('inicio');
  expect(vidrieraIdx).toBeGreaterThan(0);
  expect(resenasIdx).toBeGreaterThan(vidrieraIdx);
  expect(historiaIdx).toBeGreaterThan(resenasIdx);
  expect(contactoIdx).toBeGreaterThan(historiaIdx);
});

test('el carrusel de destacados muestra un producto, con puntos, y avanza al tocarlos', async ({ page }) => {
  await page.goto('/');
  const carrusel = page.locator('section[aria-label="Ofertas y destacados"]');
  await expect(carrusel).toBeVisible();
  const tituloInicial = await carrusel.locator('h2').textContent();

  const puntos = carrusel.getByRole('tab');
  const total = await puntos.count();
  expect(total).toBeGreaterThan(1);

  await puntos.nth(1).click();
  await expect(carrusel.locator('h2')).not.toHaveText(tituloInicial || '');
  await expect(puntos.nth(1)).toHaveAttribute('aria-selected', 'true');
});

test('cada vidriera linkea "Ver todo" al mundo correcto', async ({ page }) => {
  await page.goto('/');
  const vidriera = page.locator('section[aria-labelledby="vidriera-cumpleanos"]');
  await expect(vidriera.getByRole('link', { name: 'Ver todo →' })).toHaveAttribute('href', '/cumpleanos');
});

test('un mundo sin productos todavía muestra el estado vacío, no una grilla en blanco', async ({ page }) => {
  await page.goto('/');
  const vidriera = page.locator('section[aria-labelledby="vidriera-halloween"]');
  await vidriera.scrollIntoViewIfNeeded();
  await expect(vidriera.getByText('Halloween está por venir')).toBeVisible();
  await expect(vidriera.getByRole('link', { name: 'Ver otros mundos' })).toHaveAttribute('href', '/explorar');
});

test('las secciones sin cambios (confianza/reseñas/historia/contacto) siguen ahí', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#historia')).toBeVisible();
  await expect(page.locator('#resenas')).toBeVisible();
  await expect(page.locator('#visitanos')).toBeVisible();
  await expect(page.locator('#contacto')).toBeVisible();
});

test('contraste WCAG AA en el hero y el carrusel (axe-core)', async ({ page }) => {
  await page.goto('/');
  const resultados = await new AxeBuilder({ page })
    .include('header#inicio')
    .include('section[aria-label="Ofertas y destacados"]')
    .withTags(['wcag2aa'])
    .analyze();
  const contraste = resultados.violations.filter((v) => v.id === 'color-contrast');
  expect(contraste, JSON.stringify(contraste, null, 2)).toEqual([]);
});
