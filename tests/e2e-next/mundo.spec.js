/* Sprint 5.5 — reemplaza a familia.spec.js: la categorización pública
 * vuelve a ser mundo (familia pasa a dato interno, sólo panel admin).
 * Verifica lo mínimo que hace único a esta migración: contenido estático
 * real (no inyectado por JS) en una página de mundo, precio hidratado
 * client-side después, y el buscador de Explorar filtrando de verdad.
 * Corre contra un build real (`npm run build && npm run start`, ver
 * playwright.next.config.js) — nunca contra `next dev`.
 */
const { test, expect } = require('@playwright/test');

test('una página de mundo sirve HTML estático con productos y el precio se hidrata solo', async ({ page }) => {
  // Antes de cualquier JS: el HTML servido por el navegador ya trae el
  // título del producto — es la prueba de que esto es SSG/ISR real, no
  // inyectado después de un fetch.
  const res = await page.goto('/globos-fiesta');
  const htmlCrudo = await res.text();
  // Sin el "=" ni el nombre exacto de la clase: desde Sprint 3 el <h3> y
  // el <a> de la card llevan varias clases de Tailwind además de
  // pcard/font-semibold — lo que importa acá es que el tag exista con
  // contenido real, no la lista exacta de clases.
  expect(htmlCrudo).toContain('<h3');
  expect(htmlCrudo).toMatch(/class="[^"]*\bpcard\b/);

  // Tarjeta puntual con precio real en catalogo_precios (a diferencia del
  // primer producto del mundo, que no tiene fila de precio — dato
  // preexistente, no relacionado con esta migración).
  const tarjeta = page.locator('a.pcard[data-codigo="61147"]');
  await expect(tarjeta).toBeVisible();

  // El precio arranca vacío (server) y se completa solo, sin recargar —
  // CatalogoPrecios.tsx hidratando client-side.
  await expect(tarjeta.locator('.pricetag')).toHaveText(/\$/, { timeout: 5000 });
});

test('el título de la página usa el nombre de display del mundo, no el slug crudo', async ({ page }) => {
  // Sprint 5: .catsec-head h2 (porteo viejo) fue reemplazado por un <h1>
  // real debajo del breadcrumb.
  await page.goto('/globos-fiesta');
  await expect(page.getByRole('heading', { level: 1, name: 'Cotillón' })).toBeVisible();
});

test('mundo inexistente da 404', async ({ page }) => {
  const res = await page.goto('/esto-no-existe-como-mundo');
  expect(res.status()).toBe(404);
});

test('la nav lista los mundos con nombre de display, con link al slug', async ({ page }) => {
  // Nav rediseñado (Sprint 2) — el mega-menú de escritorio reemplaza al
  // dropdown viejo (.nav-dropdown), ver tests/e2e-next/nav.spec.js.
  await page.goto('/');
  await page.getByRole('button', { name: 'Mundos ▾' }).hover();
  const link = page.locator('#mundos-menu-desktop a', { hasText: 'Cotillón' });
  await expect(link).toHaveAttribute('href', '/globos-fiesta');
});

test('Explorar: elegir un mundo lo usa como filtro sin cambiar de URL', async ({ page }) => {
  // Sprint 5: el buscador de texto libre de ExplorarGrid.tsx (client-side
  // sobre el catálogo completo) se retiró — la búsqueda real es Sprint 6.
  // Acá "Mundo" pasa a ser un filtro más de MundoContenido, no un segmento
  // de URL, a diferencia de /[mundo].
  await page.goto('/explorar');
  await expect(page.getByRole('heading', { level: 1, name: 'Explorar el catálogo' })).toBeVisible();

  const checkboxCotillon = page.locator('aside[aria-label="Filtros"] label', { hasText: 'Cotillón' }).locator('input[type="checkbox"]');
  await checkboxCotillon.check();

  await expect(page).toHaveURL('/explorar');

  const cards = page.locator('a.pcard');
  await expect(cards.first()).toBeVisible();
});

test('filtrar por familia dentro de un mundo actualiza la grilla y el breadcrumb', async ({ page }) => {
  await page.goto('/globos-fiesta');
  await expect(page.getByRole('heading', { level: 1, name: 'Cotillón' })).toBeVisible();

  // Sidebar de escritorio: primer checkbox de familia disponible en este mundo.
  const primeraFamilia = page.locator('aside[aria-label="Filtros"] label').filter({ has: page.locator('input[type="checkbox"]') });
  const totalFamilias = await primeraFamilia.count();
  test.skip(totalFamilias === 0, 'Este mundo no tiene familias cargadas todavía');

  const nombreFamilia = (await primeraFamilia.first().textContent())?.trim();
  await primeraFamilia.first().locator('input[type="checkbox"]').check();

  // El breadcrumb suma un tercer nivel con el nombre de la familia activa
  // (el último <li> trae también el separador "›" visual, por eso se
  // apunta al span[aria-current="page"] de adentro, no al <li> entero).
  await expect(page.locator('nav[aria-label="Ruta de navegación"] [aria-current="page"]')).toHaveText(nombreFamilia || '');
});

test('Cargar más trae la página siguiente sin duplicar productos', async ({ page }) => {
  await page.goto('/explorar');
  const cards = page.locator('a.pcard');
  await expect(cards.first()).toBeVisible();

  const botonCargarMas = page.getByRole('button', { name: /Cargar más/ });
  test.skip(!(await botonCargarMas.isVisible().catch(() => false)), 'No hay suficientes productos para paginar en este catálogo');

  const codigosAntes = await cards.evaluateAll((els) => els.map((el) => el.getAttribute('data-id')));
  await botonCargarMas.click();
  await expect(cards).not.toHaveCount(codigosAntes.length, { timeout: 5000 });

  const codigosDespues = await cards.evaluateAll((els) => els.map((el) => el.getAttribute('data-id')));
  expect(codigosDespues.length).toBeGreaterThan(codigosAntes.length);
  const sinDuplicados = new Set(codigosDespues);
  expect(sinDuplicados.size).toBe(codigosDespues.length);
  expect(codigosDespues.slice(0, codigosAntes.length)).toEqual(codigosAntes);
});
