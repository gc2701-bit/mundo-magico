/* Genera assets/subcategorias-html.js: qué tarjetas (por su slug de título)
   tiene cada <section class="catsec" id="..."> migrada del HTML, por página.
   assets/mundo-menu.js lo usa para saber si una subcategoría del mega-menú
   "Nuestros mundos" quedó sin ningún producto visible (todas sus tarjetas
   ocultas/movidas) y no listarla — cosa que, a diferencia de una
   subcategoría 100% nacida en el panel de admin, no se puede calcular sólo
   con datos de la base: la mayoría de las tarjetas de una sección migrada
   nunca tocan catalogo_tarjetas, así que sin este censo no hay forma de
   saber cuántas tiene la sección en total.

   Volvé a correrlo cada vez que se agregue/saque una tarjeta a mano del
   HTML (no hace falta para lo que ya se mueve/oculta desde el panel de
   admin, eso se lee en vivo):
     node .claude/gen-subcategorias-html.js */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// Mismas 5 páginas que tienen barra de categorías (ver assets/mundo-menu.js
// SUBCATS) — combos-v2.html no entra: una sola sección, sin catbar.
const PAGES = [
  'globos-fiesta-v2.html',
  'cumpleanos-v2.html',
  'decoracion-v2.html',
  'disfraces-v2.html',
  'reposteria-v2.html'
];

// Mismo algoritmo que slug() en assets/admin-catalogo.js / precios.js /
// site.js — tiene que dar el mismo resultado en todos lados para que la
// clave (pagina, slug) sea la misma fila.
function slug(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function decode(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// Saca los comentarios HTML antes de parsear: las secciones "ocultas a
// pedido" (Rincones/Paredes/Textiles en decoración, La mesa dulce/Para
// regalar en repostería) viven DENTRO de un <!-- ... --> — sin sacarlos
// primero, sus tarjetas-teaser (que ni siquiera son .pcard) contaminarían
// el censo de la sección real más cercana si el regex las cruzara mal.
function sinComentarios(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function tarjetasDeSeccion(html) {
  const out = [];
  const cardRe = /<a\b[^>]*\bclass="[^"]*pcard[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let cm;
  while ((cm = cardRe.exec(html)) !== null) {
    const inner = cm[1];
    const h3m = inner.match(/<h3>([\s\S]*?)<\/h3>/);
    if (!h3m) continue;
    const title = decode(h3m[1].replace(/<[^>]*>/g, '').trim());
    if (!title) continue;
    out.push(slug(title));
  }
  return out;
}

const data = {};
let totalSecciones = 0;
for (const page of PAGES) {
  const file = path.join(ROOT, page);
  if (!fs.existsSync(file)) { console.log('  ⚠ no existe', page); data[page] = {}; continue; }
  const html = sinComentarios(fs.readFileSync(file, 'utf8'));
  const secRe = /<section class="catsec" id="([^"]+)">([\s\S]*?)<\/section>/g;
  const porSeccion = {};
  let sm;
  while ((sm = secRe.exec(html)) !== null) {
    porSeccion[sm[1]] = tarjetasDeSeccion(sm[2]);
  }
  data[page] = porSeccion;
  totalSecciones += Object.keys(porSeccion).length;
  console.log(page, '->', Object.keys(porSeccion).length, 'secciones');
}

const out =
  '/* Generado por .claude/gen-subcategorias-html.js — no editar a mano.\n' +
  '   Censo de qué tarjetas (por slug de título) tiene cada sección migrada\n' +
  '   del HTML, para que assets/mundo-menu.js pueda sacar del mega-menú una\n' +
  '   subcategoría que se quedó sin ningún producto visible. */\n' +
  'window.__SUBCATS_HTML__ = ' + JSON.stringify(data, null, 0) + ';\n';

fs.writeFileSync(path.join(ROOT, 'assets', 'subcategorias-html.js'), out);
console.log('Listo:', totalSecciones, 'secciones ->', 'assets/subcategorias-html.js');
