/* Genera las tarjetas de producto (.pcard) leyendo la carpeta /productos
   y las inyecta en las páginas entre los marcadores <!--GEN:clave--> ... <!--/GEN-->.
   Volvé a correrlo cada vez que agregues o saques fotos:  node .claude/gen-products.js */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PROD = path.join(ROOT, 'productos');

// Acentos/ñ que faltan en los nombres de archivo, para que se vean bien en la web
const ACC = {
  cotillon:'cotillón', linea:'línea', cumpleanos:'cumpleaños', cumpleano:'cumpleaño',
  espanoles:'españoles', espanol:'español', panuelos:'pañuelos', panuelo:'pañuelo',
  monos:'moños', mono:'moño', puno:'puño', algodon:'algodón',
  plasticos:'plásticos', plastico:'plástico', purpura:'púrpura', neon:'neón', bombin:'bombín',
  corazon:'corazón'
};
function accent(s){
  return s.replace(/[A-Za-zÁÉÍÓÚáéíóúñ]+/g, w => {
    const low = w.toLowerCase();
    if (ACC[low]) { const r = ACC[low]; return w[0] === w[0].toUpperCase() ? r[0].toUpperCase()+r.slice(1) : r; }
    return w;
  });
}
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function parseName(file){
  let base = file.replace(/\.(jpe?g|png|webp)$/i,'').trim();
  let sub = '';
  const m = base.match(/\(([^)]+)\)/);
  if (m){ sub = m[1].trim(); base = base.replace(/\s*\([^)]*\)\s*/,' ').trim(); }
  const d = base.indexOf(' - ');
  let name = base;
  if (d > -1){ const dash = base.slice(d+3).trim(); name = base.slice(0,d).trim(); sub = sub ? (dash + ' · ' + sub) : dash; }
  return { name: accent(name), sub: accent(sub) };
}

function encPath(rel){ return rel.split('/').map(encodeURIComponent).join('/'); }

function card(folder, file){
  const { name, sub } = parseName(file);
  const src = encPath('productos/' + folder + '/' + file);
  const subHtml = sub ? `<span class="sub">${esc(sub)}</span>` : '';
  return `      <a class="pcard reveal" href="#"><div class="pcard-ph"><img src="${src}" alt="${esc(name)}" loading="lazy"></div><div class="pcard-body"><h3>${esc(name)}</h3>${subHtml}<span class="cta">Ver en la tienda →</span></div></a>`;
}

function files(folder){
  const dir = path.join(PROD, folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();
}

function subfolders(folder){
  const dir = path.join(PROD, folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
}

function colorOf(file){
  return accent(file.replace(/\.(jpe?g|png|webp)$/i, '').trim().split(/\s+/).pop());
}

// Una subcarpeta = un producto con variantes de color (p.ej. cada tipo de anteojo).
// Genera una galería: la foto "todos" primero (vista general) y luego cada color,
// con flechas y puntos para pasar las fotos individuales (ver site.js / base.css).
function variantCard(parent, sub){
  const imgs = files(parent + '/' + sub);
  if (!imgs.length) return null;
  const todos   = imgs.filter(f => /todos/i.test(f));
  const singles = imgs.filter(f => !/todos/i.test(f));
  const ordered = [...todos, ...singles];
  const name = accent(sub);
  const colors = singles.map(colorOf);

  const slides = ordered.map((f, i) => {
    const cap = /todos/i.test(f) ? 'Todos los colores' : colorOf(f);
    const src = encPath('productos/' + parent + '/' + sub + '/' + f);
    return `<img src="${src}" alt="${esc(name + ' · ' + cap)}" data-cap="${esc(cap)}" loading="lazy">`;
  }).join('');

  const subHtml = colors.length ? `<span class="sub">${esc(colors.join(', '))}</span>` : '';

  let gallery = `<div class="gtrack">${slides}</div>`;
  if (ordered.length > 1){
    const dots = ordered.map((f, i) => `<span class="gdot${i === 0 ? ' is-on' : ''}"></span>`).join('');
    const cap0 = /todos/i.test(ordered[0]) ? 'Todos los colores' : (colors[0] || '');
    gallery +=
      `<button class="gnav gprev" type="button" aria-label="Foto anterior">&#8249;</button>` +
      `<button class="gnav gnext" type="button" aria-label="Foto siguiente">&#8250;</button>` +
      `<span class="gcap">${esc(cap0)}</span>` +
      `<div class="gdots">${dots}</div>`;
  }

  return `      <a class="pcard reveal has-gallery" href="#"><div class="pcard-ph">${gallery}</div><div class="pcard-body"><h3>${esc(name)}</h3>${subHtml}<span class="cta">Ver en la tienda →</span></div></a>`;
}

function classifyDisfraz(file){
  if (/^Disfra/i.test(file)) return 'trajes';
  if (/neon|fluo|glitter|lentejuela|hawaian|led|luces|strass|fedora|vaquero|bombin|hada|reflectiv|tinsel|corbatin|corbatas/i.test(file)) return 'fiesta';
  return 'patrio';
}

function classifyCotillon(file){
  if (/anteojo|pulsera|glow|gorr|vincha/i.test(file)) return 'lucir';
  if (/cortina|panel|shimmer|tela|lentejuela|globos estrella|guirnalda/i.test(file)) return 'ambientar';
  return 'extras';
}

function inject(page, marker, html){
  const file = path.join(ROOT, page);
  let txt = fs.readFileSync(file, 'utf8');
  const re = new RegExp('(<!--GEN:'+marker+'-->)([\\s\\S]*?)(<!--/GEN-->)');
  if (!re.test(txt)) { console.log('  ⚠ no se encontró el marcador', marker, 'en', page); return; }
  txt = txt.replace(re, '$1\n' + html + '\n$3');
  fs.writeFileSync(file, txt);
}

// ---- Categorías simples (carpeta -> un marcador) ----
const SIMPLE = [
  { folder: '2. Linea de cumpleanos', page: 'cumpleanos.html', marker: 'cumple' },
  { folder: '3. Reposteria', page: 'reposteria.html',          marker: 'reposteria' },
];
for (const c of SIMPLE){
  const list = files(c.folder);
  const html = list.map(f => card(c.folder, f)).join('\n');
  inject(c.page, c.marker, html);
  console.log(c.page, '->', c.marker, ':', list.length, 'productos');
}

// ---- Cotillón (una carpeta -> 3 ambientes) ----
const cFolder = '1. Cotillon y fiestas';
const cot = { ambientar: [], lucir: [], extras: [] };
for (const f of files(cFolder)) cot[classifyCotillon(f)].push(card(cFolder, f));
// Subcarpetas (tipos de anteojos con variantes de color) -> una tarjeta cada una
for (const sf of subfolders(cFolder)){
  const c = variantCard(cFolder, sf);
  if (c) cot[classifyCotillon(sf)].push(c);
}
for (const g of ['ambientar','lucir','extras']){
  const html = cot[g].join('\n');
  inject('cotillon.html', 'cot-'+g, html);
  console.log('cotillon.html -> cot-'+g, ':', cot[g].length, 'productos');
}

// ---- Disfraces (una carpeta -> 3 escenas) ----
const dFolder = '5. Disfraces';
const groups = { trajes: [], patrio: [], fiesta: [] };
for (const f of files(dFolder)) groups[classifyDisfraz(f)].push(f);
for (const g of ['trajes','patrio','fiesta']){
  const html = groups[g].map(f => card(dFolder, f)).join('\n');
  inject('disfraces.html', 'disf-'+g, html);
  console.log('disfraces.html -> disf-'+g, ':', groups[g].length, 'productos');
}

console.log('Listo.');
