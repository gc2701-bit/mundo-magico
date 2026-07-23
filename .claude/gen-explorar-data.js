/* Genera assets/explorar-data.js: un snapshot de todos los productos leído de las
   páginas de categoría (.pcard). Explorar lo usa como respaldo cuando fetch() no
   está disponible (al abrir explorar.html como archivo local, protocolo file://).
   Volvé a correrlo cada vez que cambien los productos:
     node .claude/gen-explorar-data.js
   (Servido por HTTP no hace falta: ahí Explorar lee las páginas en vivo.) */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// Mismas categorías/páginas que assets/explorar.js (CATS). Repostería queda
// afuera: reposteria-v2.html todavía usa ítems de ícono + texto, sin tarjetas
// .pcard con foto, así que no hay nada que este script pueda extraer de ahí.
const PAGES = [
  'globos-fiesta-v2.html',
  'cumpleanos-v2.html',
  'decoracion-v2.html',
  'disfraces-v2.html',
  'combos-v2.html',
  'especiales-v2.html'
];

// Decodifica las entidades HTML que usa el sitio, para que el texto quede igual
// que el que devuelve el navegador (getAttribute / textContent ya vienen decodificados).
function decode(s) {
  return (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function attr(tag, name) {
  const m = tag.match(new RegExp(name + '="([^"]*)"'));
  return m ? decode(m[1]) : '';
}

function parsePage(html) {
  const out = [];
  // Cada tarjeta: un <a> cuya clase contiene "pcard" (el atributo class puede no
  // ser el primero; los anchors no se anidan, así que el cierre es directo).
  const cardRe = /<a\b[^>]*\bclass="[^"]*pcard[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let cm;
  while ((cm = cardRe.exec(html)) !== null) {
    const full = cm[0];
    const inner = cm[1];
    const openTag = full.slice(0, full.indexOf('>') + 1);

    // Fotos: sólo las que están dentro de .pcard-ph (antes de .pcard-body).
    const bodyAt = inner.indexOf('pcard-body');
    const phPart = bodyAt > -1 ? inner.slice(0, bodyAt) : inner;
    const images = [];
    const imgRe = /<img\b[^>]*>/g;
    let im;
    while ((im = imgRe.exec(phPart)) !== null) {
      const src = attr(im[0], 'src');
      if (!src) continue;
      images.push({ src: src, cap: attr(im[0], 'data-cap'), alt: attr(im[0], 'alt') });
    }
    if (!images.length) continue;

    const h3m = inner.match(/<h3>([\s\S]*?)<\/h3>/);
    const title = h3m ? decode(h3m[1].replace(/<[^>]*>/g, '').trim()) : (images[0].alt || '');

    let specs = [];
    const ds = attr(openTag, 'data-specs');
    if (ds) {
      specs = ds.split('|').map(s => s.trim()).filter(Boolean);
    } else {
      const subm = inner.match(/<span class="sub">([\s\S]*?)<\/span>/);
      if (subm) specs = [decode(subm[1].replace(/<[^>]*>/g, '').trim())];
    }

    let price = attr(openTag, 'data-price');
    if (!price) {
      const tagm = phPart.match(/<[^>]*class="pricetag"[^>]*>([\s\S]*?)<\/[^>]*>/);
      if (tagm) price = decode(tagm[1].replace(/<[^>]*>/g, '').trim());
    }

    out.push({
      title: title,
      images: images,
      specs: specs,
      price: price,
      wamsg: attr(openTag, 'data-wamsg')
    });
  }
  return out;
}

const data = {};
let total = 0;
for (const page of PAGES) {
  const file = path.join(ROOT, page);
  if (!fs.existsSync(file)) { console.log('  ⚠ no existe', page); data[page] = []; continue; }
  const html = fs.readFileSync(file, 'utf8');
  const list = parsePage(html);
  data[page] = list;
  total += list.length;
  console.log(page, '->', list.length, 'productos');
}

const out =
  '/* Generado por .claude/gen-explorar-data.js — no editar a mano.\n' +
  '   Snapshot de productos para que Explorar funcione al abrir el archivo local\n' +
  '   (file://), donde fetch() de las páginas está bloqueado por el navegador. */\n' +
  'window.__EXPLORAR_DATA__ = ' + JSON.stringify(data, null, 0) + ';\n';

fs.writeFileSync(path.join(ROOT, 'assets', 'explorar-data.js'), out);
console.log('Listo:', total, 'productos ->', 'assets/explorar-data.js');
