/* PROVE-IT: chequeos estáticos de las mejoras de performance pendientes
 * (ver mundo-magico/CLAUDE.md, sección "Performance" de la auditoría de
 * 2026-08-13). Cada uno de estos tests hoy FALLA a propósito contra el HTML
 * sin modificar — son la guía para el fix y la confirmación de que se hizo,
 * sin tener que levantar un navegador.
 *
 * Se leen los archivos .html tal cual se sirven (no hay build step: lo que
 * está en el repo es lo que Netlify manda) y se los analiza como texto/DOM
 * ligero — no hace falta ejecutar JS para probar "qué tags manda el HTML".
 */
import { describe, it, expect } from 'vitest';
import { readHtml } from '../helpers/loadScript.js';

const PAGINAS_CATEGORIA = [
  'globos-fiesta-v2.html', 'cumpleanos-v2.html', 'disfraces-v2.html',
  'reposteria-v2.html', 'decoracion-v2.html', 'combos-v2.html', 'especiales-v2.html'
];

describe('B2 — admin-catalogo.js/.css no deberían mandarse a TODOS los visitantes de una página de categoría', () => {
  // Hoy las 7 páginas de categoría cargan admin-catalogo.css (~13KB) y
  // admin-catalogo.js (~110KB+) con un <link>/<script> normal en el <head>/
  // antes de </body> — se descargan y ejecutan para cualquier visitante,
  // admin o no. El gate de es_admin() (ver assets/admin-catalogo.js y
  // tests/unit/admin-gate.test.js) sólo decide si se DIBUJA la barra, no si
  // el bundle se baja. El fix pendiente es cargar ese script/CSS con JS
  // (por ejemplo un <script> chico e inline que inyecte el <link>/<script>
  // reales sólo después de que es_admin() resuelva true) en vez de tags
  // estáticos en el HTML.
  PAGINAS_CATEGORIA.forEach((pagina) => {
    it(`${pagina}: no debería tener un <script src="assets/admin-catalogo.js"> incondicional`, () => {
      const html = readHtml(pagina);
      expect(html).not.toMatch(/<script[^>]+src=["']assets\/admin-catalogo\.js["']/);
    });

    it(`${pagina}: no debería tener un <link ... admin-catalogo.css> incondicional`, () => {
      const html = readHtml(pagina);
      expect(html).not.toMatch(/<link[^>]+href=["']assets\/admin-catalogo\.css["']/);
    });
  });
});

describe('B3 — hero de index.html: usar .webp/.jpg en vez de .png pesado', () => {
  // 19 fotos de producto + las tiles del hero de la home todavía están en
  // PNG (herramienta de conversión ya vive en el repo: sharp, ver
  // .claude/package.json). Este test cubre las tiles del hero, que son las
  // primeras imágenes que carga cualquier visita a la home.
  it('las tiles "tile-img" del hero referencian .webp o .jpg, no .png', () => {
    const html = readHtml('index.html');
    const srcs = [...html.matchAll(/class="tile-img"[^>]*src="([^"]+)"/g)].map((m) => m[1]);
    // Si este assert de longitud falla, el selector de arriba ya no matchea
    // el markup actual del hero — hay que actualizar el test, no ignorarlo.
    expect(srcs.length).toBeGreaterThan(0);
    srcs.forEach((src) => {
      expect(src).toMatch(/\.(webp|jpg|jpeg)$/i);
    });
  });

  it('la ilustración 3D del local (assets/mundos/local-3d-web-wide) referencia .webp o .jpg, no .png', () => {
    const html = readHtml('index.html');
    const m = html.match(/src="(assets\/mundos\/local-3d-web-wide[^"]*)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toMatch(/\.(webp|jpg|jpeg)$/i);
  });
});

describe('B4 — _headers: Cache-Control para assets estáticos', () => {
  // Alcance reducido a propósito (decisión explícita con el usuario, ver
  // SPEC.md sección 5): hashear nombres de archivo requeriría reescribir los
  // ~18 <script>/<link> de cada página para resolver el nombre con hash —
  // mucho más invasivo que deduplicar header/nav/footer. Se optó por un
  // Cache-Control moderado (max-age corto + stale-while-revalidate) SIN
  // hash, así que el test verifica eso — no un max-age largo, que sí
  // rompería el sitio en el próximo deploy sin hash de por medio.
  it('assets/, productos/ y Logo/ tienen Cache-Control con stale-while-revalidate, sin max-age largo', () => {
    const headers = readHtml('_headers');
    for (const prefix of ['/assets/*', '/productos/*', '/Logo/*']) {
      const bloque = headers.split(prefix + '\n')[1];
      expect(bloque, prefix + ' debería existir en _headers').toBeTruthy();
      const linea = bloque.split('\n')[0];
      expect(linea).toMatch(/Cache-Control:\s*public,\s*max-age=\d+,\s*stale-while-revalidate=\d+/);
      const maxAge = Number(linea.match(/max-age=(\d+)/)[1]);
      expect(maxAge, prefix + ' no debería tener un max-age largo sin hash de contenido').toBeLessThanOrEqual(86400);
    }
  });
});
