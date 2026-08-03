/* Capa de datos del catálogo (precio, stock, tarjetas ocultas). Sin DOM: lo
 * único que hace es conseguir el JSON y decidir de dónde sale. Lo consume
 * assets/precios.js para pintar, y assets/admin-catalogo.js para guardar.
 *
 * Reemplaza a la Google Sheet publicada como fuente de verdad — ver el
 * comentario de cabecera de precios.js (versión vieja) para el porqué del
 * cambio. La cascada de ORIGEN de los datos:
 *
 *   1. sessionStorage (10 min) — mismo criterio que el CACHE_MIN de antes:
 *      sin esto, cada cambio de página es otra llamada.
 *   2. Supabase (catalogo_publico(), un solo viaje ya agregado) — la fuente
 *      de verdad en vivo. Usa el cliente que ya creó assets/cuenta.js
 *      (window.MMCuenta.cliente()), nunca uno propio.
 *   3. localStorage "último bueno", SIN vencimiento — si Supabase no
 *      contesta, un visitante que ya estuvo alguna vez ve los precios de su
 *      última visita en vez de nada.
 *   4. window.__PRECIOS_DATOS__ (assets/precios-datos.js, el respaldo local
 *      de siempre) — para el visitante nuevo con Supabase caído.
 *   5. Nada. Las tarjetas quedan exactamente como hoy: sin precio, con la
 *      consulta por WhatsApp. Nunca se inventa un precio.
 *
 * Forma de `datos()`:
 *   {
 *     origen:        'cache' | 'supabase' | 'ultimo-bueno' | 'respaldo-local' | 'sin-datos',
 *     precios:       { codigo: precio },
 *     sinStock:      { codigo: true },              // set, no array — para poder parchear
 *     fotos:         { rutaDecodificada: codigo },
 *     tarjetas:      { 'pagina~slug': {oculta, sinStock, precioFijo, subcategoriaId, codigoOverride} },
 *     subcategorias: { id: {pagina, nombre, slug, orden} },
 *     productos:     [ {id, pagina, subcategoriaId, titulo, slug, codigo, specs, descripcion, tags, talles, fotos, orden} ]
 *   }
 *
 * subcategorias/productos son la Fase 2 (productos cargados desde la web y
 * subcategorías creadas desde el navegador) — respaldoLocal() y el
 * "último bueno" viejo (guardado antes de este cambio) pueden no traerlos,
 * de ahí los `|| {}` / `|| []` de abajo.
 */
(function () {
  'use strict';

  var SESSION_KEY = 'mm_catalogo_v1';
  var LOCAL_KEY = 'mm_catalogo_ok';
  var CACHE_MIN = 10;

  var cache = null;       // ya resuelto en esta carga de página
  var pendiente = null;   // promesa en curso, para no pedir dos veces en paralelo

  function vacio(origen) {
    return { origen: origen, precios: {}, sinStock: {}, fotos: {}, tarjetas: {}, subcategorias: {}, productos: [] };
  }

  // Del array que devuelve la RPC (sinStock: ["04375", ...]) al set que usa
  // el resto del módulo — así MMCatalogo.parche() puede tocar un código
  // suelto sin tener que reconstruir el array entero.
  function normalizar(cruda, origen) {
    var sinStock = {};
    (cruda.sinStock || []).forEach(function (c) { sinStock[c] = true; });
    return {
      origen: origen,
      precios: cruda.precios || {},
      sinStock: sinStock,
      fotos: cruda.fotos || {},
      tarjetas: cruda.tarjetas || {},
      subcategorias: cruda.subcategorias || {},
      productos: cruda.productos || []
    };
  }

  // Misma guarda que la vieja perdioLosCeros() de precios.js, aplicada acá
  // porque acá es donde ahora se decide si una fuente es confiable. En
  // Postgres los códigos no pueden perder los ceros en el transporte (la
  // columna es `text`, no numérica) — lo que esto detecta es una migración
  // mal hecha (ver .claude/gen-catalogo-sql.js), no un problema de Google.
  function perdioLosCeros(precios) {
    var local = window.__PRECIOS_DATOS__;
    if (!local) return false;
    var enLocal = 0, enNuevo = 0, k;
    for (k in local) if (/^0\d/.test(k)) enLocal++;
    for (k in precios) if (/^0\d/.test(k)) enNuevo++;
    return enLocal >= 20 && enNuevo < enLocal / 4;
  }

  function leerStorage(storage, clave, conTTL) {
    try {
      var guardado = JSON.parse(storage.getItem(clave) || 'null');
      if (!guardado) return null;
      if (conTTL && (Date.now() - guardado.t) >= CACHE_MIN * 60000) return null;
      return guardado.d;
    } catch (e) { return null; }
  }

  function guardarStorage(storage, clave, datos) {
    try { storage.setItem(clave, JSON.stringify({ t: Date.now(), d: datos })); }
    catch (e) { /* modo privado, o el cupo se llenó: no es motivo para fallar */ }
  }

  function deSupabase() {
    if (!window.MMCuenta) return Promise.resolve(null);
    var sb = window.MMCuenta.cliente();
    if (!sb) return Promise.resolve(null);
    return sb.rpc('catalogo_publico').then(function (r) {
      if (r.error || !r.data) return null;
      if (perdioLosCeros(r.data.precios || {})) return null;
      return normalizar(r.data, 'supabase');
    }).catch(function () { return null; });
  }

  function respaldoLocal() {
    if (!window.__PRECIOS_DATOS__) return null;
    var d = vacio('respaldo-local');
    d.precios = window.__PRECIOS_DATOS__;
    return d;
  }

  function resolver() {
    var deSesion = leerStorage(sessionStorage, SESSION_KEY, true);
    if (deSesion) { cache = deSesion; return Promise.resolve(cache); }

    return deSupabase().then(function (d) {
      if (d) {
        cache = d;
        guardarStorage(sessionStorage, SESSION_KEY, d);
        guardarStorage(localStorage, LOCAL_KEY, d);
        return cache;
      }
      var ultimoBueno = leerStorage(localStorage, LOCAL_KEY, false);
      if (ultimoBueno) {
        cache = {
          origen: 'ultimo-bueno',
          precios: ultimoBueno.precios, sinStock: ultimoBueno.sinStock, fotos: ultimoBueno.fotos, tarjetas: ultimoBueno.tarjetas,
          subcategorias: ultimoBueno.subcategorias || {}, productos: ultimoBueno.productos || []
        };
        return cache;
      }
      var local = respaldoLocal();
      if (local) { cache = local; return cache; }

      cache = vacio('sin-datos');
      return cache;
    });
  }

  function cargar(cb) {
    if (cache) { cb(cache); return; }
    if (!pendiente) pendiente = resolver().then(function (d) { pendiente = null; return d; });
    pendiente.then(cb);
  }

  function refrescar(cb) {
    cache = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    pendiente = null;
    cargar(cb);
  }

  // Mete un cambio recién guardado en memoria, sin esperar el próximo
  // fetch — es lo que permite repintar al instante después de editar desde
  // admin-catalogo.js. También invalida la caché de sesión: la próxima vez
  // que se cargue una página, va a la base en vez de servir un blob viejo
  // por hasta 10 minutos.
  //
  // productos NO se parchea acá: es una lista (no un mapa por clave) y las
  // altas/bajas/movidas de mundo son poco frecuentes — más simple pedirle a
  // admin-catalogo.js que llame refrescar() después de tocar
  // catalogo_productos que mantener un merge por id acá.
  function parche(obj) {
    if (!cache) return;
    if (obj.precios) { for (var c in obj.precios) cache.precios[c] = obj.precios[c]; }
    if (obj.sinStock) { for (var s in obj.sinStock) cache.sinStock[s] = obj.sinStock[s]; }
    if (obj.fotos) { for (var f in obj.fotos) cache.fotos[f] = obj.fotos[f]; }
    if (obj.tarjetas) { for (var t in obj.tarjetas) cache.tarjetas[t] = obj.tarjetas[t]; }
    if (obj.subcategorias) { for (var sc in obj.subcategorias) cache.subcategorias[sc] = obj.subcategorias[sc]; }
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  window.MMCatalogo = {
    cargar: cargar,
    datos: function () { return cache; },
    refrescar: refrescar,
    parche: parche
  };
})();
