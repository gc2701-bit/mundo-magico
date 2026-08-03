/* Red de seguridad de la clave (pagina, slug): catalogo_tarjetas identifica
 * cada tarjeta del HTML por (pagina, slug del <h3>) — si alguien renombra un
 * producto en el HTML, el slug cambia y la fila de catalogo_tarjetas (oculta,
 * subcategoria_id, codigo_override, colores_sin_stock, precio_fijo…) deja de
 * aplicar EN SILENCIO: el producto reaparece a precio de lista, sin nota de
 * que hay una edición "colgada" en la base.
 *
 * Este script no escribe nada — sólo compara y avisa. Lee la base con la
 * clave anon (la misma que ya viaja en cada visita, protegida por RLS de
 * sólo-lectura pública en catalogo_tarjetas) y compara contra lo que hay HOY
 * en las 7 páginas -v2.html.
 *
 * Uso:
 *   node .claude/check-catalogo.js
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

function slug(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function decodeEnt(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function leerConfig() {
  const texto = fs.readFileSync(path.join(ROOT, 'assets', 'supabase-config.js'), 'utf8');
  const url = texto.match(/url:\s*'([^']+)'/);
  const key = texto.match(/anonKey:\s*'([^']+)'/);
  if (!url || !key) throw new Error('No encontré url/anonKey en assets/supabase-config.js');
  return { url: url[1], anonKey: key[1] };
}

function tarjetasDePagina(pagina) {
  const file = path.join(ROOT, pagina);
  if (!fs.existsSync(file)) { console.log('  ⚠ no existe', pagina); return {}; }
  const html = fs.readFileSync(file, 'utf8');
  const out = {};
  const cardRe = /<a\b[^>]*\bclass="[^"]*pcard[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let cm;
  while ((cm = cardRe.exec(html)) !== null) {
    const h3m = cm[1].match(/<h3>([\s\S]*?)<\/h3>/);
    if (!h3m) continue;
    const titulo = decodeEnt(h3m[1].replace(/<[^>]*>/g, '').trim());
    if (!titulo) continue;
    out[slug(titulo)] = titulo;
  }
  return out;
}

async function main() {
  const cfg = leerConfig();

  console.log('── Tarjetas actuales en las 7 páginas ──────────────────────');
  const enHtml = {}; // pagina -> {slug: titulo}
  PAGES.forEach(function (pg) {
    enHtml[pg] = tarjetasDePagina(pg);
    console.log(' ', pg, '→', Object.keys(enHtml[pg]).length, 'tarjetas');
  });

  console.log('\n── Consultando catalogo_tarjetas ────────────────────────────');
  const resp = await fetch(
    cfg.url + '/rest/v1/catalogo_tarjetas?select=pagina,slug,titulo_ref,oculta,subcategoria_id,codigo_override,colores_sin_stock',
    { headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey } }
  );
  if (!resp.ok) {
    console.error('✗ No pude leer catalogo_tarjetas:', resp.status, await resp.text());
    process.exit(1);
  }
  const filas = await resp.json();
  console.log('Filas en catalogo_tarjetas:', filas.length);

  const huerfanas = [];
  const sospechosas = [];
  filas.forEach(function (f) {
    const pagina = enHtml[f.pagina];
    if (!pagina) { huerfanas.push(f); return; } // página que ya ni está en PAGES
    const tituloActual = pagina[f.slug];
    if (tituloActual === undefined) { huerfanas.push(f); return; }
    if (f.titulo_ref && tituloActual !== f.titulo_ref) sospechosas.push(Object.assign({ tituloActual: tituloActual }, f));
  });

  console.log('\n── Resultado ─────────────────────────────────────────────');
  if (!huerfanas.length && !sospechosas.length) {
    console.log('✓ Todo coincide: ninguna fila de catalogo_tarjetas quedó huérfana.');
    return;
  }

  if (huerfanas.length) {
    console.log('\n✗ ' + huerfanas.length + ' fila(s) SIN tarjeta correspondiente en el HTML (renombrada o borrada):');
    huerfanas.forEach(function (f) {
      const edits = [];
      if (f.oculta) edits.push('oculta');
      if (f.subcategoria_id) edits.push('subcategoria');
      if (f.codigo_override) edits.push('codigo_override=' + f.codigo_override);
      if (f.colores_sin_stock && f.colores_sin_stock.length) edits.push('colores_sin_stock=' + f.colores_sin_stock.join(','));
      console.log('  ', f.pagina, '~', f.slug, f.titulo_ref ? '("' + f.titulo_ref + '")' : '',
        edits.length ? '— tenía: ' + edits.join(', ') : '— sin ediciones (no urgente)');
    });
  }

  if (sospechosas.length) {
    console.log('\n⚠ ' + sospechosas.length + ' fila(s) cuyo título actual no coincide con titulo_ref (mismo slug, texto distinto):');
    sospechosas.forEach(function (f) {
      console.log('  ', f.pagina, '~', f.slug, '— era "' + f.titulo_ref + '", ahora "' + f.tituloActual + '"');
    });
  }

  console.log('\nEsto no rompe nada solo, pero las filas de arriba con ediciones');
  console.log('reales (oculta/subcategoria/codigo_override/colores_sin_stock) dejaron');
  console.log('de aplicar en silencio. Revisar a mano si esa edición sigue haciendo falta');
  console.log('y volver a cargarla desde el panel de admin sobre la tarjeta actual.');
}

main().catch(function (err) {
  console.error('✗', err.message || err);
  process.exit(1);
});
