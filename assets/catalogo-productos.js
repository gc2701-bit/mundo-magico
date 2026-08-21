/* Productos cargados desde la web (catalogo_productos), Fase 2 del catálogo
 * editable. Se carga ANTES que assets/precios.js en las 7 páginas: inserta
 * las tarjetas de esta página como <a class="pcard" data-pos="…"> reales
 * ANTES de que precios.js escanee `.pcard`, así que el precio, "sin stock"
 * y el resto de la cascada de precios.js los tratan exactamente igual que
 * a una tarjeta escrita a mano — no hay lógica de precio duplicada acá.
 *
 * window.MMCatalogoProductos.repintar() vuelve a leer MMCatalogo.datos() e
 * inserta sólo lo que todavía no está en el DOM (marcado con
 * data-mm-producto-id) — es lo que usa admin-catalogo.js después de cargar
 * un producto nuevo, para mostrarlo al toque sin recargar la página.
 */
(function () {
  'use strict';

  // SIEMPRE con ".html" al final — si Netlify sirve las URLs sin extensión
  // ("Pretty URLs"), esto daría "disfraces-v2" y nunca coincidiría con
  // catalogo_productos.pagina ("disfraces-v2.html"): ningún producto de esa
  // página se pintaría nunca, en silencio.
  var partesUrl = location.pathname.split('/').filter(Boolean);
  var segUrl = partesUrl.length ? partesUrl[partesUrl.length - 1] : 'index';
  var pagina = /\.html?$/i.test(segUrl) ? segUrl : segUrl + '.html';
  var renderizados = {}; // id de catalogo_productos → true

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  // Mismo criterio de "crear la sección si no existe" que usa precios.js
  // para subcategoria_id — duplicado a propósito: son dos fuentes de datos
  // distintas (tarjetas del HTML vs. productos de la base) y mezclarlas en
  // una sola función las hace depender una de la otra sin necesidad.
  function crearSeccion(id, titulo) {
    var section = el('section', 'catsec');
    section.id = id;
    var wrap = el('div', 'wrap');
    var head = el('div', 'catsec-head is-visible');
    var h2 = document.createElement('h2');
    h2.textContent = titulo;
    head.appendChild(h2);
    var pgrid = el('div', 'pgrid');
    wrap.appendChild(head);
    wrap.appendChild(pgrid);
    section.appendChild(wrap);

    var otros = document.querySelector('main > section.otros');
    var main = document.querySelector('main');
    if (otros && otros.parentNode) otros.parentNode.insertBefore(section, otros);
    else if (main) main.appendChild(section);

    return pgrid;
  }

  function pgridPara(producto, subcategorias) {
    var sub = producto.subcategoriaId ? subcategorias[producto.subcategoriaId] : null;
    if (sub && sub.pagina === pagina) {
      // Mismo orden que pgridDe() en precios.js: primero el id tal cual
      // (subcategoría migrada desde una <section> del HTML), recién
      // después el prefijo "cat-" de las creadas desde el navegador.
      var existente = document.getElementById(sub.slug) || document.getElementById('cat-' + sub.slug);
      return existente ? existente.querySelector('.pgrid') : crearSeccion('cat-' + sub.slug, sub.nombre);
    }
    // Sin subcategoría (o de un mundo que ya no es este, dato inconsistente):
    // va a una sección genérica al final, nunca se pierde de la vista.
    var novedades = document.getElementById('mm-nuevos');
    return novedades ? novedades.querySelector('.pgrid') : crearSeccion('mm-nuevos', 'Novedades');
  }

  // producto.fotos es [{src, cap}] — cap vacío para un producto simple, uno
  // por color para una galería (mismo dato que ya guarda data-cap en las
  // tarjetas del HTML). producto.talles es [{nombre, codigo}] — se traduce
  // 1 a 1 al mismo data-talles="Nombre:codigo;…" que ya sabe leer
  // assets/producto.js, así que ni precios.js ni carrito.js necesitan saber
  // que este talle vino de acá y no de una tarjeta escrita a mano.
  function tarjetaDe(producto) {
    var esTalles = producto.talles && producto.talles.length > 1;
    var fotos = producto.fotos || [];
    var esGaleria = !esTalles && fotos.length > 1;

    var a = document.createElement('a');
    a.className = 'pcard is-visible' + (esGaleria ? ' has-gallery' : '');
    a.href = '#';
    a.setAttribute('data-mm-producto-id', producto.id);
    if (esTalles) {
      a.setAttribute('data-talles', producto.talles.map(function (t) {
        return t.nombre + ':' + t.codigo;
      }).join(';'));
    } else if (producto.codigo) {
      a.setAttribute('data-pos', producto.codigo);
    }
    if (producto.specs && producto.specs.length) a.setAttribute('data-specs', producto.specs.join('|'));
    if (producto.tags && producto.tags.length) a.setAttribute('data-tags', producto.tags.join(' '));
    if (producto.descripcion) a.setAttribute('data-desc', producto.descripcion);

    var ph = el('div', 'pcard-ph');
    if (esGaleria) {
      var track = el('div', 'gtrack');
      fotos.forEach(function (f) {
        var im = document.createElement('img');
        im.src = f.src || '';
        im.alt = producto.titulo + (f.cap ? ' · ' + f.cap : '');
        im.setAttribute('data-cap', f.cap || '');
        // Galería con código propio por color (f.codigo — a diferencia de
        // producto.codigo, que es el compartido de "varios colores, mismo
        // precio"): precios.js ya sabe leer un data-pos puesto en LA FOTO
        // como candidato de más prioridad que el heredado de la tarjeta
        // (ver preciosDeTarjeta()/candidatos() en assets/precios.js) — es
        // el mismo mecanismo que ya usa una galería escrita a mano cuando
        // cada color resuelve su propio código.
        if (f.codigo) im.setAttribute('data-pos', f.codigo);
        im.width = 600; im.height = 600; im.loading = 'lazy';
        track.appendChild(im);
      });
      ph.appendChild(track);
      var gprev = document.createElement('button');
      gprev.type = 'button'; gprev.className = 'gnav gprev';
      gprev.setAttribute('aria-label', 'Foto anterior'); gprev.innerHTML = '&#8249;';
      var gnext = document.createElement('button');
      gnext.type = 'button'; gnext.className = 'gnav gnext';
      gnext.setAttribute('aria-label', 'Foto siguiente'); gnext.innerHTML = '&#8250;';
      ph.appendChild(gprev);
      ph.appendChild(gnext);
      var gcap = el('span', 'gcap');
      gcap.textContent = fotos[0].cap || '';
      ph.appendChild(gcap);
      var gdots = el('div', 'gdots');
      fotos.forEach(function (f, idx) {
        gdots.appendChild(el('span', 'gdot' + (idx === 0 ? ' is-on' : '')));
      });
      ph.appendChild(gdots);
    } else {
      var img = document.createElement('img');
      img.src = (fotos[0] && fotos[0].src) || '';
      img.alt = producto.titulo;
      img.width = 600; img.height = 600; img.loading = 'lazy';
      ph.appendChild(img);
    }
    a.appendChild(ph);

    var body = el('div', 'pcard-body');
    var h3 = document.createElement('h3');
    h3.textContent = producto.titulo;
    body.appendChild(h3);

    // Ficha técnica visible en la tarjeta, igual que la que site.js arma a
    // partir de data-specs para las tarjetas del HTML (esta corre después,
    // no la ve).
    if (producto.specs && producto.specs.length) {
      var ul = el('ul', 'specs');
      producto.specs.forEach(function (s) {
        s = String(s || '').trim();
        if (!s) return;
        var li = document.createElement('li');
        li.textContent = s;
        ul.appendChild(li);
      });
      if (ul.children.length) body.appendChild(ul);
    }

    var cta = el('span', 'cta');
    cta.textContent = 'Ver en la tienda →';
    body.appendChild(cta);
    a.appendChild(body);

    return a;
  }

  function slugify(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function pintar(datos) {
    var productos = (datos.productos || []).filter(function (p) {
      return p.pagina === pagina && !renderizados[p.id];
    });
    if (!productos.length) return;
    var subcategorias = datos.subcategorias || {};
    var wantedSlug = new URLSearchParams(location.search).get('p');
    var targetDeepLink = null;

    productos.forEach(function (producto) {
      var pgrid = pgridPara(producto, subcategorias);
      if (!pgrid) return;
      var card = tarjetaDe(producto);
      pgrid.appendChild(card);
      renderizados[producto.id] = true;
      if (window.MMFicha) window.MMFicha.registrar(card);
      // has-gallery: arma flechas/puntos — mismo bucle que site.js corre para
      // las tarjetas del HTML, pero esta tarjeta nació después de que corrió.
      if (card.classList.contains('has-gallery') && window.MMGaleria) MMGaleria.registrar(card);
      if (wantedSlug && slugify(producto.titulo) === wantedSlug) targetDeepLink = card;
    });

    // Deep link (?p=slug): site.js ya hizo este chequeo para las tarjetas del
    // HTML antes de que estas existieran. Si el que buscaban es uno de los
    // que acabamos de insertar, abrir la ficha ahora.
    if (targetDeepLink && window.MMFicha && !window.MMFicha.abierta()) {
      targetDeepLink.scrollIntoView({ block: 'center' });
      window.MMFicha.abrir(targetDeepLink);
    }
  }

  function arrancar() {
    if (!window.MMCatalogo) return;
    MMCatalogo.cargar(pintar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  // admin-catalogo.js llama esto después de refrescar MMCatalogo (subida de
  // foto nueva, o "mover a otro mundo" con destino = esta misma página) para
  // que el producto aparezca sin recargar. Si datos() todavía no resolvió
  // (visita nueva, sin cache), no hace nada — arrancar() ya se encarga.
  window.MMCatalogoProductos = {
    repintar: function () {
      if (!window.MMCatalogo) return;
      var datos = MMCatalogo.datos();
      if (datos) pintar(datos);
    },
    // admin-catalogo.js llama esto después de EDITAR un producto ya
    // publicado (código, tipo, fotos, talles…) — a diferencia de repintar(),
    // que sólo agrega productos nunca vistos, esto vuelve a dibujar uno que
    // ya está en pantalla desde cero. Es más simple y más confiable que
    // tratar de mutar en el lugar un carrusel/selector de talles ya armado:
    // un cambio de tipo (ej. "simple" a "varios colores") cambia la
    // estructura entera del DOM de la tarjeta, no sólo un atributo.
    actualizar: function (id) {
      if (!window.MMCatalogo) return;
      var datos = MMCatalogo.datos();
      if (!datos) return;
      var existente = document.querySelector('[data-mm-producto-id="' + id + '"]');
      if (existente) existente.remove();
      delete renderizados[id];
      // Si ya no está publicado, o se movió a otro mundo, pintar() no la va
      // a volver a insertar acá — es lo correcto: ya no pertenece a esta
      // página.
      pintar(datos);
    }
  };
})();
