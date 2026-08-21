/* Funciones puras de la migración de tarjetas del HTML a catalogo_productos
 * (Sprint 1 de docs/superpowers/plans/2026-08-20-nextjs-migracion-familias-plan.md,
 * Task 1.2). Separadas del script de I/O (migrar-tarjetas-a-productos.js)
 * para poder testearlas sin mockear filesystem/DOM/Supabase — ver
 * tests/unit/migrar-tarjetas.test.js.
 */
'use strict';

// Mismo slug que assets/precios.js/site.js/explorar.js (slugify): NFD, saca
// diacríticos, todo lo que no sea a-z0-9 se vuelve '-'. Tiene que coincidir
// a mano con esas — es la clave (pagina, slug) de catalogo_tarjetas.
function slugify(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// "Chico:9283;Grande:4228" -> [{label:'Chico', code:'9283'}, ...]
// Igual a leerPares() de assets/producto.js.
function leerPares(raw) {
  if (!raw) return null;
  var out = [];
  String(raw).split(';').forEach(function (par) {
    var i = par.indexOf(':');
    if (i < 0) return;
    var label = par.slice(0, i).trim();
    var code = par.slice(i + 1).trim();
    if (label && code) out.push({ label: label, code: code });
  });
  return out.length ? out : null;
}

// Resuelve la familia de un producto migrado. Prioridad:
//   1. Match directo de `codigo` contra el mapa código→familia del espejo
//      de Búho (catalogo_buho_espejo).
//   2. Para productos de talles (sin código único): si TODOS los códigos de
//      sus opciones resuelven a la MISMA familia, se usa esa. Si resuelven a
//      familias distintas (o ninguna), se deja sin familia — no hay forma
//      correcta de elegir una sola sin adivinar, queda para que el admin la
//      asigne a mano (ver spec, sección 4, punto 3).
//   3. Sin match de ningún tipo: null — el producto queda "sin familia"
//      hasta que se le asigne una a mano o el código correcto le llegue del
//      worker.
function resolverFamilia(codigo, talles, familiaPorCodigo) {
  if (codigo) {
    var directa = familiaPorCodigo[codigo];
    return directa || null;
  }
  if (talles && talles.length) {
    var familias = talles
      .map(function (t) { return familiaPorCodigo[t.code]; })
      .filter(Boolean);
    var unicas = familias.filter(function (f, i) { return familias.indexOf(f) === i; });
    if (unicas.length === 1 && familias.length === talles.length) return unicas[0];
    return null;
  }
  return null;
}

// Código efectivo de un producto simple (no-talles): el codigo_override del
// overlay de catalogo_tarjetas manda sobre el data-pos escrito en el HTML —
// mismo criterio que ya usa assets/precios.js (preciosDeTarjeta con
// tarjetaOv.codigoOverride).
function codigoEfectivo(dataPos, overlay) {
  if (overlay && overlay.codigo_override) return overlay.codigo_override;
  return dataPos || null;
}

// Arma la fila lista para insertar en catalogo_productos a partir de los
// datos ya parseados de una tarjeta y su overlay (si existe). No hace I/O.
function filaProducto(tarjeta, overlay, familiaPorCodigo) {
  var esTalles = !!(tarjeta.talles && tarjeta.talles.length);
  var codigo = esTalles ? null : codigoEfectivo(tarjeta.dataPos, overlay);
  var talles = esTalles
    ? tarjeta.talles.map(function (t) { return { nombre: t.label, codigo: t.code }; })
    : null;
  var oculta = !!(overlay && overlay.oculta);

  return {
    pagina: tarjeta.pagina,
    slug: tarjeta.slug,
    subcategoria_id: (overlay && overlay.subcategoria_id) || null,
    titulo: tarjeta.titulo,
    codigo: codigo,
    specs: tarjeta.specs.length ? tarjeta.specs : null,
    descripcion: tarjeta.descripcion || null,
    tags: tarjeta.tags.length ? tarjeta.tags : null,
    talles: talles,
    fotos: tarjeta.fotos,
    publicado: !oculta,
    // resolverFamilia espera el shape original {label, code} (no el ya
    // traducido a {nombre, codigo} de arriba, que es el formato de salida
    // para la base, no de entrada para esta función).
    familia: resolverFamilia(codigo, esTalles ? tarjeta.talles : null, familiaPorCodigo)
  };
}

module.exports = { slugify: slugify, leerPares: leerPares, resolverFamilia: resolverFamilia, codigoEfectivo: codigoEfectivo, filaProducto: filaProducto };
