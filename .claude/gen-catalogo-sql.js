/* Migración de un solo uso: junta los precios (respaldo local + Sheet en
 * vivo exportada a CSV), el mapeo foto→código, y las 328 tarjetas escritas
 * a mano en las páginas -v2.html, y escribe supabase/catalogo_90_datos.sql
 * con los INSERT para correr una sola vez en el SQL Editor.
 *
 * Antes de correrlo:
 *   1. Bajar de nuevo los dos CSV EN VIVO de la Sheet (los links están en
 *      assets/precios.js, constantes SHEET_PRECIOS/SHEET_CODIGOS) y
 *      guardarlos pisando plantilla-precios/1-Precios.csv y 2-Codigos.csv
 *      — el CSV guardado en el repo puede estar viejo.
 *   2. node .claude/gen-catalogo-sql.js
 *      Imprime un diff ANTES de escribir nada. Si algo se ve raro (muchos
 *      precios distintos, pocos códigos con cero), parar ahí y revisar a
 *      mano — no correr el SQL generado.
 *
 * Fuente de precios: el CSV gana donde difiere del respaldo local (es lo
 * que se estuvo editando a mano más recientemente); el respaldo local
 * completa los códigos que el CSV no tiene. La alerta de "perdió los
 * ceros" es la misma que ya usa assets/precios.js en tiempo de ejecución:
 * si el CSV tiene muchos menos códigos con cero adelante que el respaldo,
 * probablemente Google convirtió la columna Código a número al importar.
 *
 * No migra __PRECIOS_ALIAS__: ese mapa (código sin ceros → código real)
 * sigue viviendo en assets/precios-datos.js, generado por
 * .claude/gen-precios.py, y el sitio lo sigue leyendo desde ahí sin
 * importar de dónde salió `precios` — ver el comentario en
 * assets/precios.js sobre por qué queda afuera de esta migración.
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

/* ------------------------------------------------------------ respaldo local */

function leerPreciosDatos() {
  const texto = fs.readFileSync(path.join(ROOT, 'assets', 'precios-datos.js'), 'utf8');
  const m = texto.match(/window\.__PRECIOS_DATOS__\s*=\s*(\{[\s\S]*?\n\});/);
  if (!m) throw new Error('No encontré __PRECIOS_DATOS__ en assets/precios-datos.js');
  return JSON.parse(m[1]);
}

/* ---------------------------------------------------------------- CSV real */
// Copia exacta de leerCSV()/aNumero()/columna()/sinTildes() de
// assets/precios.js — los nombres del POS traen comas ("GLOBO X50, LISO")
// y comillas de pulgada (12" X 25), así que partir por coma no alcanza.

function leerCSV(texto) {
  var filas = [], fila = [], campo = '', dentro = false, i;
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
  for (i = 0; i < texto.length; i++) {
    var c = texto[i];
    if (dentro) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else dentro = false;
      } else campo += c;
    } else if (c === '"') dentro = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

var ACENTO_MIN = 0x300, ACENTO_MAX = 0x36f;
function sinTildes(s) {
  s = String(s || '');
  var d = s.normalize('NFD'), out = '';
  for (var i = 0; i < d.length; i++) {
    var c = d.charCodeAt(i);
    if (c < ACENTO_MIN || c > ACENTO_MAX) out += d[i];
  }
  return out;
}

function columna(encabezado, nombres) {
  var limpio = encabezado.map(function (h) { return sinTildes(h).toLowerCase().trim(); });
  for (var n = 0; n < nombres.length; n++) {
    for (var i = 0; i < limpio.length; i++) {
      if (limpio[i].indexOf(nombres[n]) === 0) return i;
    }
  }
  return -1;
}

function aNumero(txt) {
  if (typeof txt === 'number') return txt;
  var s = String(txt || '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/\.(?=\d{3}(\D|$))/g, '');
  var n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : 0;
}

function tablaPrecios(csv) {
  var filas = leerCSV(csv);
  var cCod = columna(filas[0], ['codigo']);
  var cPre = columna(filas[0], ['precio']);
  if (cCod < 0 || cPre < 0) throw new Error('1-Precios.csv no tiene columna Codigo/Precio');
  var mapa = {}, nombres = {};
  var cNom = columna(filas[0], ['producto']);
  for (var i = 1; i < filas.length; i++) {
    var cod = (filas[i][cCod] || '').trim();
    var p = aNumero(filas[i][cPre]);
    if (cod && p > 0 && !(cod in mapa)) {
      mapa[cod] = p;
      if (cNom >= 0) nombres[cod] = (filas[i][cNom] || '').trim();
    }
  }
  return { precios: mapa, nombres: nombres };
}

function tablaCodigos(csv) {
  var filas = leerCSV(csv);
  var cFoto = columna(filas[0], ['foto']);
  var cCod = columna(filas[0], ['codigo']);
  if (cFoto < 0 || cCod < 0) throw new Error('2-Codigos.csv no tiene columna Foto/Codigo');
  var mapa = {};
  for (var i = 1; i < filas.length; i++) {
    var foto = (filas[i][cFoto] || '').trim();
    var cod = (filas[i][cCod] || '').trim();
    if (foto && cod) mapa[foto] = cod;
  }
  return mapa;
}

/* --------------------------------------------------------------- tarjetas */
// Mismo slug que assets/site.js (slugify) y assets/explorar.js (slug): NFD,
// saca diacríticos, todo lo que no sea a-z0-9 se vuelve '-', sin guiones en
// las puntas. Tiene que coincidir a mano con esas dos porque no hay forma
// de compartir código entre este script (Node) y el navegador.
function slug(s) {
  var ACENTO = /[\u0300-\u036f]/g;
  return (s || '').toLowerCase().normalize('NFD').replace(ACENTO, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function decodeEnt(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function tarjetasDePagina(pagina) {
  const file = path.join(ROOT, pagina);
  if (!fs.existsSync(file)) { console.log('  ⚠ no existe', pagina); return []; }
  const html = fs.readFileSync(file, 'utf8');
  const out = [];
  const cardRe = /<a\b[^>]*\bclass="[^"]*pcard[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let cm;
  while ((cm = cardRe.exec(html)) !== null) {
    const h3m = cm[1].match(/<h3>([\s\S]*?)<\/h3>/);
    if (!h3m) continue;
    const titulo = decodeEnt(h3m[1].replace(/<[^>]*>/g, '').trim());
    if (!titulo) continue;
    out.push({ pagina: pagina, slug: slug(titulo), titulo: titulo });
  }
  return out;
}

/* -------------------------------------------------------------------- SQL */

function sqlStr(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}
function sqlStrOrNull(s) {
  return s ? sqlStr(s) : 'null';
}

function main() {
  console.log('── Leyendo fuentes ──────────────────────────────────────────');
  const local = leerPreciosDatos();
  const localKeys = Object.keys(local);
  console.log('Respaldo local (precios-datos.js):', localKeys.length, 'códigos');

  const csvPreciosPath = path.join(ROOT, 'plantilla-precios', '1-Precios.csv');
  const csvCodigosPath = path.join(ROOT, 'plantilla-precios', '2-Codigos.csv');
  if (!fs.existsSync(csvPreciosPath) || !fs.existsSync(csvCodigosPath)) {
    console.error('Faltan plantilla-precios/1-Precios.csv o 2-Codigos.csv');
    process.exit(1);
  }
  const csvRes = tablaPrecios(fs.readFileSync(csvPreciosPath, 'utf8'));
  const csvPrecios = csvRes.precios, csvNombres = csvRes.nombres;
  const csvKeys = Object.keys(csvPrecios);
  console.log('CSV de la Sheet (1-Precios.csv):', csvKeys.length, 'códigos');

  const conCeroLocal = localKeys.filter(function (k) { return /^0\d/.test(k); }).length;
  const conCeroCsv = csvKeys.filter(function (k) { return /^0\d/.test(k); }).length;
  console.log('Códigos con cero adelante — local:', conCeroLocal, '· CSV:', conCeroCsv);

  // Misma guarda que perdioLosCeros() en assets/precios.js: si el CSV tiene
  // muchos menos códigos con cero que el respaldo, Google probablemente
  // convirtió la columna a número al importar. No hay nada que fusionar en
  // ese caso: hay que corregir el CSV (destildar "Convertir el texto a
  // números, fechas y fórmulas" al importar) y volver a correr esto.
  if (conCeroLocal >= 20 && conCeroCsv < conCeroLocal / 4) {
    console.error('\n✗ El CSV parece haber perdido los ceros a la izquierda (' +
      conCeroCsv + ' vs ' + conCeroLocal + ' esperados). NO sigo.');
    console.error('  Revisá plantilla-precios/COMO-USAR.md antes de reimportar.');
    process.exit(1);
  }

  // Unión: el CSV gana donde difiere (es la edición más reciente).
  const unionCruda = Object.assign({}, local, csvPrecios);
  let difieren = 0;
  csvKeys.forEach(function (k) {
    if (k in local && local[k] !== csvPrecios[k]) difieren++;
  });
  console.log('Unión final:', Object.keys(unionCruda).length, 'códigos ·', difieren, 'con precio distinto (gana el CSV)');

  // catalogo_precios.precio es integer con check (precio > 0): el respaldo
  // local trae unos pocos precios con centavos (redondeo del export del POS,
  // ej. 6037.9) y a veces alguno directamente basura (ej. "TARJ": 0.10, que
  // redondeado da 0 y viola el check). Se redondea al peso más cercano — los
  // precios de la web nunca tuvieron centavos — y lo que quede en 0 se saca
  // de la migración en vez de hacer fallar el INSERT entero.
  const union = {};
  const descartados = [];
  Object.keys(unionCruda).forEach(function (cod) {
    const redondeado = Math.round(unionCruda[cod]);
    if (redondeado > 0) union[cod] = redondeado;
    else descartados.push({ codigo: cod, precio: unionCruda[cod] });
  });
  const unionKeys = Object.keys(union);
  if (descartados.length) {
    console.log('\n⚠ Se excluyen', descartados.length, 'código(s) con precio inválido (no migran, van a quedar sin precio hasta cargarlos a mano):');
    descartados.forEach(function (d) { console.log('  ', d.codigo, '->', d.precio); });
  }

  // El par canónico del comentario de precios.js: si sobreviven los dos con
  // precios distintos, los ceros llegaron bien.
  if (union['01985'] || union['1985']) {
    console.log('Chequeo 01985/1985:', union['01985'], '/', union['1985'],
      union['01985'] !== union['1985'] ? '(OK, son productos distintos)' : '(⚠ revisar)');
  }

  const codigos = tablaCodigos(fs.readFileSync(csvCodigosPath, 'utf8'));
  console.log('Foto → código (2-Codigos.csv):', Object.keys(codigos).length, 'filas con código cargado');

  console.log('\n── Tarjetas de las 7 páginas ────────────────────────────────');
  let tarjetas = [];
  PAGES.forEach(function (pg) {
    const t = tarjetasDePagina(pg);
    console.log(' ', pg, '→', t.length, 'tarjetas');
    tarjetas = tarjetas.concat(t);
  });
  const vistos = {};
  const dupes = [];
  tarjetas.forEach(function (t) {
    const k = t.pagina + '~' + t.slug;
    if (vistos[k]) dupes.push(k); else vistos[k] = true;
  });
  if (dupes.length) {
    console.error('\n✗ Slugs duplicados dentro de una misma página, no sigo:', dupes.join(', '));
    process.exit(1);
  }

  console.log('\n── Escribiendo supabase/catalogo_90_datos.sql ──────────────');
  const lotes = [];
  function inserts(nombre, filas, columnas, valores, conflicto) {
    if (!filas.length) return '';
    var out = '-- ' + nombre + ': ' + filas.length + ' filas\n';
    for (var i = 0; i < filas.length; i += 500) {
      var trozo = filas.slice(i, i + 500);
      out += 'insert into public.' + nombre + ' (' + columnas.join(', ') + ') values\n';
      out += trozo.map(function (f) { return '  (' + valores(f).join(', ') + ')'; }).join(',\n');
      out += '\n' + conflicto + ';\n\n';
    }
    return out;
  }

  var sql = '-- Catálogo 90 — Migración de un solo uso (generado por .claude/gen-catalogo-sql.js).\n' +
    '-- Correr una sola vez en el SQL Editor, DESPUÉS de catalogo_00_base.sql.\n' +
    '-- No lo vuelvas a correr después de haber editado precios/stock desde la\n' +
    '-- web: on conflict actualiza precio y sobre-escribiría lo que se cargó ahí.\n\n';

  sql += inserts('catalogo_precios', unionKeys,
    ['codigo', 'precio', 'nombre_pos'],
    function (cod) { return [sqlStr(cod), union[cod], sqlStrOrNull(csvNombres[cod])]; },
    'on conflict (codigo) do update set precio = excluded.precio, nombre_pos = coalesce(excluded.nombre_pos, public.catalogo_precios.nombre_pos)');

  var rutasCodigos = Object.keys(codigos);
  sql += inserts('catalogo_fotos', rutasCodigos,
    ['ruta', 'codigo'],
    function (ruta) { return [sqlStr(ruta), sqlStr(codigos[ruta])]; },
    'on conflict (ruta) do update set codigo = excluded.codigo');

  // do nothing: no pisar oculta/sin_stock/precio_fijo si esto se vuelve a
  // correr después de que un admin ya haya tocado algo desde la web.
  sql += inserts('catalogo_tarjetas', tarjetas,
    ['pagina', 'slug', 'titulo_ref'],
    function (t) { return [sqlStr(t.pagina), sqlStr(t.slug), sqlStr(t.titulo)]; },
    'on conflict (pagina, slug) do nothing');

  fs.writeFileSync(path.join(ROOT, 'supabase', 'catalogo_90_datos.sql'), sql);
  console.log('Listo: supabase/catalogo_90_datos.sql');
  console.log('\nRevisá el diff de arriba. Si está todo bien, pegá ese archivo en el SQL Editor.');
}

main();
