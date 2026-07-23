/* Precios y disponibilidad en vivo desde el POS (Supabase). VERSIÓN DE PRUEBA.
 *
 * Cómo funciona: cada tarjeta lleva el código del POS pegado en su HTML como
 * atributo data-pos="..." (invisible para el visitante). Si una tarjeta no lo
 * tiene, se cae al mapa viejo de assets/pos-codes.js (por la ruta de su primera
 * imagen) como respaldo. Al cargar la página se junta la lista de códigos
 * presentes y se hace UNA sola llamada al RPC catalogo_publico, que devuelve
 * solo código, precio de lista y si hay stock.
 *
 * Si un producto no está mapeado o no tiene precio cargado, la tarjeta queda
 * EXACTAMENTE como estaba (sin precio, consulta por WhatsApp) — nunca $0.
 *
 * MODO DEMO (solo en esta carpeta de prueba): como el POS todavía no tiene
 * precios cargados, cuando devuelve 0 se usa el precio de ejemplo de
 * assets/precios-demo.js. Al cargar los precios de verdad en el POS, se borra
 * precios-demo.js y DEMO pasa a false: el mismo código toma los reales.
 *
 * La anon key es pública por diseño (es la que usa cualquier app Supabase);
 * la seguridad de Fase 3 garantiza que anon SOLO puede ejecutar este RPC.
 */
(function () {
  var SUPABASE_URL = 'https://bttownppdhtwhrigtxjz.supabase.co';
  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0dG93bnBwZGh0d2hyaWd0eGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNjI3NzEsImV4cCI6MjA5ODkzODc3MX0.Yvwraxy6MYW1P2jZ71JlJnFMvZXWFxoVoiDHsDMgqhs';

  var DEMO = true;        // ← poner en false cuando el POS tenga precios reales
  var USAR_STOCK = false; // ← poner en true cuando el stock del POS esté al día

  var mapa = window.__POS_CODES__ || {};  // respaldo opcional (puede no existir)
  var demo = window.__PRECIOS_DEMO__ || {};

  var fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

  function codigo(card) {
    // 1) código pegado a la tarjeta (invisible para el visitante)
    if (card.dataset && card.dataset.pos) return card.dataset.pos;
    // 2) respaldo: mapa viejo por ruta de la primera imagen
    var img = card.querySelector('.pcard-ph img');
    if (!img) return null;
    var k;
    try { k = decodeURIComponent(img.getAttribute('src') || ''); }
    catch (e) { k = img.getAttribute('src'); }
    return mapa[k] || null;
  }

  function pintar(card, precio, disponible) {
    if (precio > 0) {
      card.dataset.price = fmt.format(precio);
      var body = card.querySelector('.pcard-body');
      if (body && !body.querySelector('.pricetag')) {
        var tag = document.createElement('span');
        tag.className = 'pricetag';
        tag.textContent = fmt.format(precio);
        body.appendChild(tag);
      }
    }
    if (USAR_STOCK && !disponible) card.classList.add('sin-stock');
  }

  function cartelDemo(n) {
    var d = document.createElement('div');
    d.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:9999;' +
      'background:#7c2d12;color:#fff;font:600 13px/1.4 system-ui,sans-serif;' +
      'padding:10px 16px;text-align:center;letter-spacing:.01em');
    d.textContent = 'CARPETA DE PRUEBA · ' + n + ' productos con precios de EJEMPLO (inventados). ' +
      'La web real no está tocada.';
    document.body.appendChild(d);
  }

  function aplicar() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.pcard'));
    var porCodigo = {};
    cards.forEach(function (card) {
      var code = codigo(card);
      if (!code) return;
      (porCodigo[code] = porCodigo[code] || []).push(card);
    });
    var codes = Object.keys(porCodigo);
    if (!codes.length) return;

    fetch(SUPABASE_URL + '/rest/v1/rpc/catalogo_publico', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: 'Bearer ' + ANON_KEY
      },
      body: JSON.stringify({ p_codes: codes })
    })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (filas) {
        var pintados = 0;
        (filas || []).forEach(function (f) {
          var precio = Number(f.price);
          if (!(precio > 0) && DEMO) precio = Number(demo[f.code]) || 0;
          (porCodigo[f.code] || []).forEach(function (card) {
            pintar(card, precio, f.disponible);
            if (precio > 0) pintados++;
          });
        });
        if (DEMO && pintados) cartelDemo(pintados);
      })
      .catch(function () { /* sin conexión al POS: la página queda como estaba */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
})();
