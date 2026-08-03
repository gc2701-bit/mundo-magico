/* Migración de un solo uso: lee las <section class="catsec" id="…"><h2>…</h2>
 * ya escritas a mano en las 7 páginas -v2.html y escribe
 * supabase/catalogo_91_subcategorias_datos.sql con los INSERT para
 * catalogo_subcategorias — correr en el SQL Editor DESPUÉS de
 * catalogo_03_subcategorias.sql.
 *
 * Por qué hace falta: sin esto, catalogo_subcategorias arranca vacía y el
 * selector de "Subcategoría en este mundo" de admin-catalogo.js sólo
 * ofrece "Sin subcategoría" o "Crear nueva" — las secciones que YA existen
 * (Cortinas, Guirnaldas, etc.) no aparecen como opción porque nunca se
 * migraron a la base.
 *
 * El slug de cada fila es el id QUE YA TIENE la <section> en el HTML (ej.
 * "cortinas"), no uno recalculado a partir del título: es lo que permite a
 * pgridDe() (assets/precios.js) encontrar la sección existente por su id y
 * reusarla, en vez de crear una <section> duplicada al lado.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const PAGES = [
  'globos-fiesta-v2.html',
  'cumpleanos-v2.html',
  'decoracion-v2.html',
  'disfraces-v2.html',
  'reposteria-v2.html',
  'combos-v2.html',
  'especiales-v2.html'
];

function decodeEnt(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function sqlStr(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function subcategoriasDePagina(pagina) {
  const file = path.join(ROOT, pagina);
  if (!fs.existsSync(file)) { console.log('  ⚠ no existe', pagina); return []; }
  const html = fs.readFileSync(file, 'utf8');
  const out = [];
  // No greedy hasta el primer <h2>: cada <section class="catsec"> trae
  // exactamente uno, en catsec-head, antes de cualquier <h3> de tarjeta.
  const secRe = /<section\b([^>]*\bclass="[^"]*\bcatsec\b[^"]*"[^>]*)>([\s\S]*?)<h2>([^<]*)<\/h2>/g;
  let sm, orden = 0;
  while ((sm = secRe.exec(html)) !== null) {
    const idm = sm[1].match(/\bid="([^"]+)"/);
    if (!idm) { console.log('  ⚠ sección catsec sin id en', pagina, '— se salta'); continue; }
    const nombre = decodeEnt(sm[3].replace(/<[^>]*>/g, '').trim());
    if (!nombre) continue;
    out.push({ pagina: pagina, slug: idm[1], nombre: nombre, orden: orden++ });
  }
  return out;
}

function main() {
  console.log('── Leyendo secciones de las 7 páginas ──────────────────────');
  let filas = [];
  PAGES.forEach(function (pg) {
    const s = subcategoriasDePagina(pg);
    console.log(' ', pg, '→', s.length, 'secciones:', s.map(function (x) { return x.slug; }).join(', '));
    filas = filas.concat(s);
  });

  const vistos = {};
  const dupes = [];
  filas.forEach(function (f) {
    const k = f.pagina + '~' + f.slug;
    if (vistos[k]) dupes.push(k); else vistos[k] = true;
  });
  if (dupes.length) {
    console.error('\n✗ ids de sección duplicados dentro de una misma página, no sigo:', dupes.join(', '));
    process.exit(1);
  }

  let sql = '-- Catálogo 91 — Subcategorías migradas desde las <section> ya escritas a\n' +
    '-- mano en las 7 páginas -v2.html (generado por .claude/gen-subcategorias-sql.js).\n' +
    '-- Correr una sola vez en el SQL Editor, DESPUÉS de catalogo_03_subcategorias.sql.\n' +
    '--\n' +
    '-- El slug de cada fila es el id que YA TIENE la <section> en el HTML, no uno\n' +
    '-- recalculado del título — así assets/precios.js (pgridDe) encuentra la\n' +
    '-- sección existente y la reusa en vez de crear una duplicada.\n' +
    '--\n' +
    '-- on conflict do nothing: si esto se vuelve a correr después de que un admin\n' +
    '-- ya haya creado a mano una subcategoría con el mismo (pagina, slug), no la pisa.\n\n';

  sql += 'insert into public.catalogo_subcategorias (pagina, nombre, slug, orden) values\n';
  sql += filas.map(function (f) {
    return '  (' + [sqlStr(f.pagina), sqlStr(f.nombre), sqlStr(f.slug), f.orden].join(', ') + ')';
  }).join(',\n');
  sql += '\non conflict (pagina, slug) do nothing;\n';

  fs.writeFileSync(path.join(ROOT, 'supabase', 'catalogo_91_subcategorias_datos.sql'), sql);
  console.log('\nListo: supabase/catalogo_91_subcategorias_datos.sql (' + filas.length + ' filas)');
  console.log('Revisá el archivo. Si está todo bien, pegalo en el SQL Editor.');
}

main();
