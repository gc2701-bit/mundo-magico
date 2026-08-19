/* PROVE-IT (cobertura, no bug): _includes/nav.njk tiene 4 ramas de
 * navVariant (index/historia/eventos/y el "else" que usan las 7 páginas de
 * categoría + combos/especiales, sin navVariant en el front matter) que
 * deciden qué links de "Inicio"/"Historia"/"Explorar" aparecen y cuál queda
 * marcado aria-current="page". Antes de este test, sólo smoke.spec.js
 * miraba que `.nav` fuera visible en index.html — ninguna de las otras 3
 * ramas, ni el contenido real del menú, tenía un chequeo automático. Un
 * cambio futuro a nav.njk (por ejemplo, tocar mal un {%- elif -%}) podía
 * romper silenciosamente el menú de una categoría entera sin que ningún
 * test lo notara.
 *
 * Se prueba contra el build real de Eleventy servido por
 * .claude/static-server.js (mismo webServer que el resto de tests/e2e/),
 * no contra el .html fuente con Nunjucks sin renderizar.
 */
const { test, expect } = require('@playwright/test');

test.describe('_includes/nav.njk — las 4 variantes de navVariant renderizan el menú correcto', () => {
  test('navVariant "index" (index.html): sólo "Historia" como link directo, sin "Inicio"', async ({ page }) => {
    await page.route('**/*.supabase.co/**', (route) => route.abort());
    await page.goto('/index.html');

    const directos = page.locator('.nav-links > a');
    await expect(directos).toHaveText(['Historia', 'Explorar', 'Eventos a medida', 'Visitanos', 'Contacto']);
    await expect(page.locator('.nav-links > a[href="#historia"]')).toBeVisible();
  });

  test('navVariant "historia" (historia-v2.html): "Inicio" + "Historia" marcada aria-current, sin "Explorar"', async ({ page }) => {
    await page.route('**/*.supabase.co/**', (route) => route.abort());
    await page.goto('/historia-v2.html');

    const directos = page.locator('.nav-links > a');
    await expect(directos).toHaveText(['Inicio', 'Historia', 'Eventos a medida', 'Visitanos', 'Contacto']);
    await expect(page.locator('.nav-links > a', { hasText: 'Historia' })).toHaveAttribute('aria-current', 'page');
  });

  test('navVariant "eventos" (eventos-v2.html): "Eventos a medida" marcada aria-current, sin "Explorar" ni "Historia"', async ({ page }) => {
    await page.route('**/*.supabase.co/**', (route) => route.abort());
    await page.goto('/eventos-v2.html');

    const directos = page.locator('.nav-links > a');
    await expect(directos).toHaveText(['Inicio', 'Eventos a medida', 'Visitanos', 'Contacto']);
    await expect(page.locator('.nav-links > a', { hasText: 'Eventos a medida' })).toHaveAttribute('aria-current', 'page');
  });

  test('sin navVariant (combos-v2.html, rama "else"): "Inicio" + "Explorar", "Eventos a medida" sin aria-current', async ({ page }) => {
    await page.route('**/*.supabase.co/**', (route) => route.abort());
    await page.goto('/combos-v2.html');

    const directos = page.locator('.nav-links > a');
    await expect(directos).toHaveText(['Inicio', 'Explorar', 'Eventos a medida', 'Visitanos', 'Contacto']);
    await expect(page.locator('.nav-links > a', { hasText: 'Eventos a medida' })).not.toHaveAttribute('aria-current', 'page');
  });

  test('el dropdown "Nuestros mundos" (compartido por las 4 variantes) siempre trae los 6 mundos', async ({ page }) => {
    await page.route('**/*.supabase.co/**', (route) => route.abort());
    await page.goto('/index.html');

    // assets/mundo-menu.js reescribe el dropdown en vivo con subcategorías
    // (mega-menu), así que después de cargar hay más de 6 <a role="menuitem">
    // en total. Los 6 links de mundo en sí (sin "#subcategoria" en el href)
    // son los que nav.njk pone de entrada — eso es lo que se prueba acá.
    const items = page.locator('.nav-dropdown a[role="menuitem"]:not([href*="#"])');
    await expect(items).toHaveCount(6);
    await expect(items).toHaveText([
      'Cotillón', 'Cumpleaños', 'Disfraces y accesorios',
      'Repostería', 'Decoración del hogar', 'Combos',
    ]);
  });
});
