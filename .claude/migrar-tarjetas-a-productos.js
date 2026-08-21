/* Migración de tarjetas del HTML a catalogo_productos (Sprint 1, Task 1.2/1.3
 * de docs/superpowers/plans/2026-08-20-nextjs-migracion-familias-plan.md).
 *
 * Parsea las tarjetas (.pcard) de las páginas de categoría, las combina con
 * su overlay de catalogo_tarjetas (si existe) y resuelve su familia contra
 * el espejo de Búho — usando las funciones puras de migrar-tarjetas-lib.js
 * (ver tests/unit/migrar-tarjetas.test.js). Deja afuera, sin tocar, las
 * tarjetas "combo" (data-incluye) — no entran en el esquema actual de
 * catalogo_productos, quedan para una tanda de combos aparte (decisión
 * tomada con el usuario, 2026-08-20).
 *
 * Extracción por regex, mismo patrón ya probado en .claude/gen-explorar-data.js
 * (no jsdom): esta es la herramienta que YA sabe leer este markup exacto, así
 * que se extiende en vez de reinventar un parser nuevo.
 *
 * Modo por defecto (dry-run): sólo imprime un resumen y escribe las filas a
 * insertar en un JSON, sin tocar ningún *.html ni la base. Con --apply
 * además borra el <a class="pcard"> migrado de su página fuente (la fila ya
 * insertada en catalogo_productos + publicado=true la reemplaza en el
 * sitio vía assets/catalogo-productos.js, que ya existe — sin esto el
 * producto se vería duplicado, ver decisión del usuario en la misma sesión).
 *
 * Uso:
 *   node .claude/migrar-tarjetas-a-productos.js                # dry-run
 *   node .claude/migrar-tarjetas-a-productos.js --apply         # aplica (borra HTML)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { slugify, leerPares, filaProducto } = require('./migrar-tarjetas-lib.js');

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');

// combos-v2.html queda afuera enteramente: sus 5 tarjetas son 100% combos
// (data-incluye) — confirmado con el usuario, no se migran en esta tanda.
// cotillon-v2.html/mesa-v2.html/para-lucir-v2.html/eventos-v2.html/
// historia-v2.html no tienen .pcard (páginas sin grilla de productos).
const PAGES = [
  'especiales-v2.html',
  'globos-fiesta-v2.html',
  'disfraces-v2.html',
  'decoracion-v2.html',
  'cumpleanos-v2.html',
  'reposteria-v2.html'
];

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

// Encuentra todos los <a class="...pcard...">...</a> de un HTML, con sus
// offsets exactos en el string original (para poder borrarlos después sin
// tocar nada más del archivo — nunca se re-serializa el documento entero).
function encontrarTarjetas(html) {
  const out = [];
  const cardRe = /<a\b[^>]*\bclass="[^"]*pcard[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let cm;
  while ((cm = cardRe.exec(html)) !== null) {
    out.push({ start: cm.index, end: cm.index + cm[0].length, full: cm[0], inner: cm[1] });
  }
  return out;
}

function parsearTarjeta(match, pagina) {
  const full = match.full;
  const inner = match.inner;
  const openTag = full.slice(0, full.indexOf('>') + 1);

  if (attr(openTag, 'data-incluye')) return { combo: true };

  const bodyAt = inner.indexOf('pcard-body');
  const phPart = bodyAt > -1 ? inner.slice(0, bodyAt) : inner;
  const fotos = [];
  const imgRe = /<img\b[^>]*>/g;
  let im;
  while ((im = imgRe.exec(phPart)) !== null) {
    const src = attr(im[0], 'src');
    if (!src) continue;
    fotos.push({ src: src, cap: attr(im[0], 'data-cap') || '' });
  }

  const h3m = inner.match(/<h3>([\s\S]*?)<\/h3>/);
  const titulo = h3m ? decode(h3m[1].replace(/<[^>]*>/g, '').trim()) : '';
  if (!titulo) return { malformada: true };

  const especs = attr(openTag, 'data-specs');
  const specs = especs ? especs.split('|').map((s) => s.trim()).filter(Boolean) : [];

  const dataTags = attr(openTag, 'data-tags');
  const tags = dataTags ? dataTags.split('|').map((s) => s.trim()).filter(Boolean) : [];

  return {
    tarjeta: {
      pagina: pagina,
      slug: slugify(titulo),
      titulo: titulo,
      dataPos: attr(openTag, 'data-pos'),
      talles: leerPares(attr(openTag, 'data-talles')),
      specs: specs,
      tags: tags,
      descripcion: attr(openTag, 'data-desc') || null,
      fotos: fotos
    }
  };
}

function claveOverlay(pagina, slug) {
  return pagina + '~' + slug;
}

function main() {
  const tarjetasPath = path.join(
    '/tmp/claude-1000/-home-carlitos-proyectos/973ae314-22dc-4b0d-9317-4fdf85cfe5f5/scratchpad',
    'catalogo_tarjetas.json'
  );
  const familiaPath = path.join(
    '/tmp/claude-1000/-home-carlitos-proyectos/973ae314-22dc-4b0d-9317-4fdf85cfe5f5/scratchpad',
    'buho_familia.json'
  );
  const overlays = JSON.parse(fs.readFileSync(tarjetasPath, 'utf8'));
  const buho = JSON.parse(fs.readFileSync(familiaPath, 'utf8'));

  const overlayPorClave = {};
  overlays.forEach((o) => { overlayPorClave[claveOverlay(o.pagina, o.slug)] = o; });
  const familiaPorCodigo = {};
  buho.forEach((b) => { familiaPorCodigo[b.codigo] = b.familia; });

  // (pagina, slug) que YA existen como fila de catalogo_productos — pasa
  // cuando alguien ya migró ese producto a mano (+ Agregar producto) sin
  // borrar la tarjeta vieja del HTML. Se descubrió en la corrida real
  // (2 casos: "bengala-de-humo" y "monos-con-luz" en globos-fiesta-v2.html)
  // vía la constraint catalogo_productos_slug_por_pagina. Estas NO se
  // insertan de nuevo (la fila real ya existe y está publicada) pero SÍ se
  // borra su <a class="pcard"> del HTML — es el duplicado stale.
  const existentesPath = path.join(
    '/tmp/claude-1000/-home-carlitos-proyectos/973ae314-22dc-4b0d-9317-4fdf85cfe5f5/scratchpad',
    'existentes.json'
  );
  const existentesSet = new Set(
    JSON.parse(fs.readFileSync(existentesPath, 'utf8')).map((e) => claveOverlay(e.pagina, e.slug))
  );

  const filas = [];
  const resumen = { total: 0, migradas: 0, yaExistian: 0, combos: 0, malformadas: 0, sinFamilia: 0, porPagina: {} };

  PAGES.forEach((pagina) => {
    const file = path.join(ROOT, pagina);
    const html = fs.readFileSync(file, 'utf8');
    const matches = encontrarTarjetas(html);
    resumen.porPagina[pagina] = { total: matches.length, migradas: 0, combos: 0, malformadas: 0 };

    const paraBorrar = [];
    matches.forEach((match) => {
      resumen.total++;
      const r = parsearTarjeta(match, pagina);
      if (r.combo) { resumen.combos++; resumen.porPagina[pagina].combos++; return; }
      if (r.malformada) {
        resumen.malformadas++;
        resumen.porPagina[pagina].malformadas++;
        console.log('  ⚠ tarjeta sin <h3> en', pagina, '— offset', match.start, ', se deja sin tocar');
        return;
      }
      const clave = claveOverlay(r.tarjeta.pagina, r.tarjeta.slug);
      if (existentesSet.has(clave)) {
        resumen.yaExistian++;
        console.log('  · ya existe como producto:', pagina, r.tarjeta.titulo, '— se borra el HTML duplicado, no se inserta de nuevo');
        paraBorrar.push(match);
        return;
      }
      const overlay = overlayPorClave[clave] || null;
      const fila = filaProducto(r.tarjeta, overlay, familiaPorCodigo);
      if (!fila.familia) resumen.sinFamilia++;
      filas.push(fila);
      resumen.migradas++;
      resumen.porPagina[pagina].migradas++;
      paraBorrar.push(match);
    });

    if (APPLY && paraBorrar.length) {
      let nuevo = html;
      // De atrás para adelante: borrar por offset no corre los índices de
      // los que faltan procesar. Se extiende cada borrado a la línea
      // completa (desde el '\n' anterior hasta el '\n' siguiente) para no
      // dejar líneas en blanco donde vivía la tarjeta.
      paraBorrar.sort((a, b) => b.start - a.start).forEach((m) => {
        let ini = nuevo.lastIndexOf('\n', m.start);
        ini = ini === -1 ? 0 : ini + 1;
        let fin = nuevo.indexOf('\n', m.end);
        fin = fin === -1 ? nuevo.length : fin + 1;
        const linea = nuevo.slice(ini, fin);
        const restoDeLinea = (linea.slice(0, m.start - ini) + linea.slice(m.end - ini)).trim();
        if (restoDeLinea === '') {
          nuevo = nuevo.slice(0, ini) + nuevo.slice(fin);
        } else {
          nuevo = nuevo.slice(0, m.start) + nuevo.slice(m.end);
        }
      });
      fs.writeFileSync(file, nuevo);
      console.log(pagina, '-> HTML actualizado,', paraBorrar.length, 'tarjeta(s) retirada(s)');
    }
  });

  const outDir = '/tmp/claude-1000/-home-carlitos-proyectos/973ae314-22dc-4b0d-9317-4fdf85cfe5f5/scratchpad';
  fs.writeFileSync(path.join(outDir, 'filas-catalogo-productos.json'), JSON.stringify(filas, null, 2));
  fs.writeFileSync(path.join(outDir, 'resumen-migracion.json'), JSON.stringify(resumen, null, 2));

  console.log('\n=== Resumen', APPLY ? '(aplicado)' : '(dry-run)', '===');
  console.log(JSON.stringify(resumen, null, 2));
}

main();
