/* PROVE-IT (cobertura, no bug): las 19 páginas raíz llevan
 * `permalink: <archivo>.html` en el front matter de Eleventy precisamente
 * para que el build siga publicando la misma URL plana de siempre
 * (`combos-v2.html`, no `combos-v2/index.html`). Es Eleventy, no Nunjucks,
 * el que decide esto: sin ese `permalink:`, el default de Eleventy para un
 * archivo de template es una URL "linda" con carpeta — confirmado con una
 * reproducción mínima fuera de este repo (una page.html sin permalink
 * termina en _site/page/index.html, no _site/page.html).
 *
 * Si alguien borra por accidente la línea `permalink:` de una de estas 19
 * páginas en una edición futura (por ejemplo, al resolver un conflicto de
 * merge en el front matter), el build de Eleventy NO falla — sigue siendo
 * un template válido — así que nada avisaría del cambio de URL salvo un
 * test que golpee la URL plana esperada contra el _site/ real y note el
 * 404. Antes de este archivo, ningún test en tests/ mencionaba "permalink"
 * (grep confirmado) ni pegaba una request HTTP a cada una de las 19 páginas.
 *
 * Se prueba contra el server real que sirve _site/ (el build real de
 * `npm run build`, mismo webServer que el resto de tests/e2e/), con el
 * fixture `request` (HTTP puro, sin levantar un browser) — más rápido y
 * más directo que goto() para esto, porque lo único que importa es qué
 * URL sirve el server, no el JS de la página.
 */
const { test, expect } = require('@playwright/test');

// Las 19 páginas raíz del repo con front matter de Eleventy (ver `git status`
// del branch feat/eleventy-migration) — cada una debe llevar
// `permalink: <este mismo nombre>` para no cambiar de URL con la migración.
const PAGINAS = [
  'admin-envios.html',
  'admin-pedidos.html',
  'combos-v2.html',
  'cotillon-v2.html',
  'cumpleanos-v2.html',
  'decoracion-v2.html',
  'disfraces-v2.html',
  'especiales-v2.html',
  'eventos-v2.html',
  'explorar.html',
  'globos-fiesta-v2.html',
  'historia-v2.html',
  'index.html',
  'mesa-v2.html',
  'para-lucir-v2.html',
  'pedido.html',
  'recuperar.html',
  'reposteria-v2.html',
  'ruta.html',
];

test.describe('permalink front matter — las 19 páginas se siguen sirviendo en su URL plana', () => {
  for (const pagina of PAGINAS) {
    test(`${pagina} responde 200 en /${pagina} (no se movió a una URL con carpeta)`, async ({ request }) => {
      const res = await request.get('/' + pagina);
      expect(
        res.status(),
        `/${pagina} debería responder 200 — si esto da 404, revisar que ` +
        `el front matter de ${pagina} todavía tenga "permalink: ${pagina}"`
      ).toBe(200);
    });
  }
});
