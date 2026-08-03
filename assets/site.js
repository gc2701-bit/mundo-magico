/* Mundo Mágico · comportamiento compartido
   - Fondo sólido del nav al hacer scroll
   - Menú móvil accesible
   - Animaciones de aparición al hacer scroll (respeta reduced-motion) */
(function () {
  'use strict';

  /* --- Número de WhatsApp (EDITÁ una sola vez acá, con código de país) --- */
  var WA_NUMBER = '5493813006343';
  var waLink = function (text) {
    return 'https://wa.me/' + WA_NUMBER + (text ? '?text=' + encodeURIComponent(text) : '');
  };

  // Envoltorio de assets/analytics.js (se carga antes que este script en
  // todas las páginas). Nombre distinto de "track" a propósito: más abajo,
  // el carrusel de fotos de cada tarjeta usa esa palabra para su propio div.
  function trackGA(name, params) {
    if (window.trackEvent) window.trackEvent(name, params);
  }

  /* --- Botón flotante de WhatsApp en todas las páginas --- */
  if (!document.querySelector('.wa-float')) {
    var fab = document.createElement('a');
    fab.className = 'wa-float';
    fab.href = waLink('¡Hola Mundo Mágico! Quiero hacer una consulta.');
    fab.target = '_blank';
    fab.rel = 'noopener';
    fab.setAttribute('aria-label', 'Escribinos por WhatsApp');
    fab.innerHTML =
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 1 1 6.97 3.86Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.57.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z"/></svg>';
    document.body.appendChild(fab);
  }

  /* --- Ficha de producto (modal): clic en un producto abre la foto en grande --- */
  var pcards = document.querySelectorAll('a.pcard[href="#"], a.pcard:not([href])');
  if (pcards.length) {
    // Categoría de la página (para el chip de la ficha), si no la trae la tarjeta
    var pageCat = '';
    var eyebrow = document.querySelector('.eyebrow');
    var h1 = document.querySelector('h1');
    if (eyebrow) pageCat = eyebrow.textContent.replace(/^mundo\s+/i, '').trim();
    else if (h1) pageCat = h1.textContent.trim();

    // Construimos el modal una sola vez y lo reutilizamos en toda la página
    var overlay = document.createElement('div');
    overlay.className = 'ficha-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Ficha de producto');
    overlay.innerHTML =
      '<div class="ficha">' +
        '<button class="ficha-close" type="button" aria-label="Cerrar">✕</button>' +
        '<div class="gal">' +
          // Las flechas de ADENTRO de la foto cambian de color/foto del mismo
          // producto. Las de cambiar de producto están afuera del cuadro (al
          // final de este mismo innerHTML): antes las dos eran la misma flecha
          // en el mismo lugar, y tocar "siguiente" esperando otro color te
          // sacaba del producto.
          '<div class="main"><img src="" alt="">' +
            '<button class="gal-nav gal-prev" type="button" aria-label="Foto anterior" hidden>‹</button>' +
            '<button class="gal-nav gal-next" type="button" aria-label="Foto siguiente" hidden>›</button>' +
          '</div>' +
          '<div class="thumbs" hidden></div></div>' +
        '<div class="info">' +
          '<span class="cat" hidden></span>' +
          '<h2></h2>' +
          '<p class="price" hidden></p>' +
          '<p class="desc" hidden></p>' +
          '<ul class="specs" hidden></ul>' +
          '<div class="items" hidden></div>' +
          // El cajón del pedido. La ficha NO sabe qué es un carrito: deja el
          // lugar y avisa cuando se abre (ver window.MMFicha, más abajo). Si
          // nadie se anota —porque se borró carrito.js de la página— queda
          // vacío y el CSS lo esconde (.ficha-cart:empty).
          '<div class="ficha-cart"></div>' +
          // Acá había un "Consultar por WhatsApp". Se sacó: la acción de la
          // ficha es armar el pedido, y dos salidas compitiendo mandaban a la
          // gente a preguntar producto por producto, que es justo lo que el
          // carrito vino a evitar. Para una consulta suelta sigue estando el
          // botón flotante de WhatsApp, que está en todas las páginas.
          '<p class="aviso">Sin vueltas: te respondemos en el horario del local 😉</p>' +
        '</div>' +
      '</div>' +
      // Fuera de .ficha a propósito: pasar al producto siguiente es salir de
      // este producto, y leerlo por fuera del cuadro lo dice sin explicarlo.
      '<button class="ficha-nav ficha-prev" type="button" aria-label="Producto anterior">‹</button>' +
      '<button class="ficha-nav ficha-next" type="button" aria-label="Producto siguiente">›</button>';
    document.body.appendChild(overlay);

    var mainImg = overlay.querySelector('.gal .main img');
    var thumbsBox = overlay.querySelector('.thumbs');
    var catEl = overlay.querySelector('.cat');
    var titleEl2 = overlay.querySelector('h2');
    var priceEl = overlay.querySelector('.price');
    var descEl = overlay.querySelector('.desc');
    var specsEl = overlay.querySelector('.specs');
    var itemsEl = overlay.querySelector('.items');
    var slotEl = overlay.querySelector('.ficha-cart');
    var closeBtn = overlay.querySelector('.ficha-close');
    var prevProductBtn = overlay.querySelector('.ficha-prev');
    var nextProductBtn = overlay.querySelector('.ficha-next');
    var galPrevBtn = overlay.querySelector('.gal-prev');
    var galNextBtn = overlay.querySelector('.gal-next');
    var galEl = overlay.querySelector('.gal');
    var lastFocus = null;
    var currentCard = null;
    var allCards = Array.prototype.slice.call(pcards);
    var ganchos = [];        // quién se hace cargo del cajón del pedido

    var show = function (el, on) { el.hidden = !on; };

    /* --- Las fotos del producto abierto ------------------------------------
     * Hay cuatro maneras de cambiar de foto —las flechas de adentro, las
     * miniaturas, el dedo, y elegir un color en el bloque del pedido— y todas
     * pasan por acá. Cuando cada una se manejaba sola, elegir un color dejaba
     * marcada la miniatura de la foto anterior. */
    var fotos = [], capsFoto = [], fotoIdx = 0, nombreActual = '';

    function mostrarFoto(src, alt) {
      mainImg.src = src || '';
      mainImg.alt = alt || nombreActual;
      // Se compara contra mainImg.src, que el navegador ya resolvió a absoluta:
      // el carrito manda la ruta relativa escrita en el HTML y las miniaturas
      // guardan la absoluta, así que crudas no coinciden nunca.
      var actual = mainImg.src;
      thumbsBox.querySelectorAll('button').forEach(function (x) {
        x.classList.toggle('is-on', x.dataset.src === actual);
      });
      return actual;
    }

    function irAFoto(i) {
      if (!fotos.length) return;
      fotoIdx = (i + fotos.length) % fotos.length;
      mostrarFoto(fotos[fotoIdx],
        nombreActual + (capsFoto[fotoIdx] ? ' — ' + capsFoto[fotoIdx] : ''));
    }

    // Lista de tarjetas por las que se puede navegar: todas, salvo que el
    // buscador de la categoría haya filtrado algunas (no tiene sentido
    // deslizar hacia un producto que no coincide con la búsqueda).
    function navList() {
      return allCards.filter(function (c) { return !c.classList.contains('is-filtered-out'); });
    }

    function updateNavButtons() {
      var list = navList();
      var canNav = list.length > 1;
      prevProductBtn.hidden = !canNav;
      nextProductBtn.hidden = !canNav;
    }

    // dir: -1 anterior, +1 siguiente. Da la vuelta al llegar a una punta.
    function goToProduct(dir) {
      var list = navList();
      var idx = list.indexOf(currentCard);
      if (idx === -1 || list.length < 2) return;
      var next = list[(idx + dir + list.length) % list.length];
      openFicha(next);
    }

    function openFicha(card) {
      lastFocus = lastFocus || card;
      currentCard = card;
      updateNavButtons();
      // Qué se puede elegir de este producto lo sabe assets/producto.js, que se
      // carga antes. La ficha lo usa para no repetir en la ficha técnica lo que
      // ya se muestra como selector.
      var modelo = window.MMProducto ? MMProducto.leer(card) : null;
      var titleEl = card.querySelector('h3');
      var name = titleEl ? titleEl.textContent.trim() : '';
      var subEl = card.querySelector('.sub');

      // Categoría
      var cat = card.dataset.cat || pageCat;
      catEl.textContent = cat;
      show(catEl, !!cat);

      titleEl2.textContent = name;

      // Precio (combos y productos con precio cerrado)
      var price = card.dataset.price || '';
      priceEl.textContent = price;
      show(priceEl, !!price);

      // Descripción explícita (intro), si la hay. Si no hay ficha técnica ni
      // descripción, caemos al subtítulo de la tarjeta como último recurso.
      var desc = card.dataset.desc || ((!card.dataset.specs && subEl) ? subEl.textContent.trim() : '');
      descEl.textContent = desc;
      show(descEl, !!desc);

      // Ficha técnica: cada dato en su propia línea (uno debajo del otro).
      // En combos, la lista "El combo trae" ya cumple ese rol, así que no la repetimos.
      //
      // Se salta el renglón que abajo se volvió un selector: repetir "Talles:
      // 1, 3" justo arriba de los botones de talle es ruido, y el día que uno
      // de los dos quede desactualizado pasa a ser una contradicción.
      specsEl.innerHTML = '';
      var showSpecs = false;
      if (!card.dataset.items && modelo) {
        modelo.specs.forEach(function (s) {
          if (s.yaEsSelector) return;
          var li = document.createElement('li');
          li.textContent = s.text;
          specsEl.appendChild(li);
          showSpecs = true;
        });
      }
      show(specsEl, showSpecs);

      // Lista "El combo trae" (combos)
      itemsEl.innerHTML = '';
      var items = card.dataset.items ? JSON.parse(card.dataset.items) : null;
      if (items && items.length) {
        var head = document.createElement('b');
        head.textContent = 'El combo trae:';
        var ul = document.createElement('ul');
        items.forEach(function (it) {
          var li = document.createElement('li');
          li.textContent = it;
          ul.appendChild(li);
        });
        itemsEl.appendChild(head);
        itemsEl.appendChild(ul);
        show(itemsEl, true);
      } else {
        show(itemsEl, false);
      }

      // Imágenes: galería de la tarjeta, o la única foto
      fotos = []; capsFoto = []; nombreActual = name;
      var galImgs = card.querySelectorAll('.gtrack img');
      if (galImgs.length) {
        galImgs.forEach(function (im) { fotos.push(im.src); capsFoto.push(im.getAttribute('data-cap') || ''); });
      } else {
        var one = card.querySelector('.pcard-ph img');
        if (one) { fotos.push(one.src); capsFoto.push(one.getAttribute('alt') || ''); }
      }

      thumbsBox.innerHTML = '';
      show(thumbsBox, fotos.length > 1);
      fotos.forEach(function (src, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.dataset.src = src;
        b.setAttribute('aria-label', 'Ver foto ' + (capsFoto[i] || (i + 1)));
        var im = document.createElement('img');
        im.src = src; im.alt = ''; im.loading = 'lazy';
        b.appendChild(im);
        b.addEventListener('click', function () { irAFoto(i); });
        thumbsBox.appendChild(b);
      });
      // Las flechas de adentro sólo tienen sentido si hay más de una foto.
      show(galPrevBtn, fotos.length > 1);
      show(galNextBtn, fotos.length > 1);
      irAFoto(0);

      // El bloque del pedido se rearma en CADA apertura (también al cambiar de
      // producto con las flechas): el slot llega siempre vacío, así ninguna
      // elección se arrastra de un producto al siguiente.
      slotEl.innerHTML = '';
      ganchos.forEach(function (fn) {
        try { fn(card, slotEl, window.MMFicha); } catch (err) { if (window.console) console.error(err); }
      });

      overlay.classList.add('open');
      document.body.classList.add('ficha-open');
      closeBtn.focus();
    }

    function closeFicha() {
      overlay.classList.remove('open');
      document.body.classList.remove('ficha-open');
      if (lastFocus) lastFocus.focus();
      lastFocus = null;
      currentCard = null;
    }

    pcards.forEach(function (card) {
      card.addEventListener('click', function (e) {
        e.preventDefault();
        openFicha(card);
      });
    });

    // Deep link desde el buscador (?p=slug-del-titulo, ver assets/search.js):
    // en vez de dejar a la persona en la grilla entera de la categoría, la
    // llevamos directo a la ficha del producto que buscó.
    var wantedSlug = new URLSearchParams(location.search).get('p');
    if (wantedSlug) {
      var slugify = function (s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      };
      var target = null;
      pcards.forEach(function (card) {
        if (target) return;
        var h3 = card.querySelector('h3');
        if (h3 && slugify(h3.textContent.trim()) === wantedSlug) target = card;
      });
      if (target) {
        target.scrollIntoView({ block: 'center' });
        openFicha(target);
      }
    }

    closeBtn.addEventListener('click', closeFicha);
    prevProductBtn.addEventListener('click', function () { goToProduct(-1); });
    nextProductBtn.addEventListener('click', function () { goToProduct(1); });
    galPrevBtn.addEventListener('click', function () { irAFoto(fotoIdx - 1); });
    galNextBtn.addEventListener('click', function () { irAFoto(fotoIdx + 1); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeFicha(); });
    document.addEventListener('keydown', function (e) {
      if (!overlay.classList.contains('open')) return;
      if (e.key === 'Escape') closeFicha();
      else if (e.key === 'ArrowLeft') goToProduct(-1);
      else if (e.key === 'ArrowRight') goToProduct(1);
    });

    // Deslizar con el dedo (celular) sobre la foto: cambia de FOTO, igual que
    // las flechas que están ahí adentro. Antes cambiaba de producto, que era lo
    // mismo que hacían esas flechas; ahora pasar de producto vive afuera del
    // cuadro y el dedo sobre la foto hace lo que la foto sugiere.
    // Se ignora si el gesto empieza sobre la tira de miniaturas (esa ya tiene
    // su propio scroll horizontal) o si el movimiento es más vertical que
    // horizontal (para no robarle el scroll de la info al dedo).
    var touchX = 0, touchY = 0, touchTracking = false;
    galEl.addEventListener('touchstart', function (e) {
      if (e.target.closest('.thumbs')) { touchTracking = false; return; }
      touchTracking = true;
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }, { passive: true });
    galEl.addEventListener('touchend', function (e) {
      if (!touchTracking) return;
      touchTracking = false;
      var dx = e.changedTouches[0].clientX - touchX;
      var dy = e.changedTouches[0].clientY - touchY;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      irAFoto(fotoIdx + (dx < 0 ? 1 : -1));
    }, { passive: true });
    // Mantener el foco dentro de la ficha con Tab.
    //
    // Se filtran los ocultos: .focus() sobre algo escondido no hace nada, así
    // que si el primero o el último de la lista está oculto el Tab se traba y
    // no se puede salir del último control. Pasa seguido: las flechas ‹ › se
    // esconden cuando hay un solo producto, el botón de WhatsApp se esconde
    // cuando el bloque del pedido está puesto, y cada − N + del pedido arranca
    // oculto mientras la cantidad es cero.
    overlay.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(
        overlay.querySelectorAll('button, a[href]'),
        function (n) { return !n.hidden && !n.disabled && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    });

    /* --- Enganche del pedido ------------------------------------------------
     * La ficha ofrece un cajón y avisa cada vez que se abre; quien quiera
     * hacerse cargo de la acción principal se anota con alAbrir(). Hoy el único
     * que se anota es assets/carrito.js. El contrato son estas funciones y no
     * el HTML de adentro: si mañana cambia el marcado de la ficha, el carrito
     * no se entera.
     *
     * verFoto existe para que el que llenó el cajón pueda cambiar la foto
     * grande al tocar un color, sin ir a tocar el DOM de la ficha por su
     * cuenta. El precio no hace falta moverlo: el de arriba es el resumen de la
     * tarjeta ("desde $X") y cada opción muestra el suyo en su lugar. */
    window.MMFicha = {
      alAbrir: function (fn) {
        if (typeof fn !== 'function' || ganchos.indexOf(fn) > -1) return;
        ganchos.push(fn);
        // Si ya hay una ficha abierta en este momento, se la damos ahora mismo
        // en vez de esperar a que el cliente la cierre y la vuelva a abrir.
        if (currentCard) openFicha(currentCard);
      },
      abrir: function (card) { if (card) openFicha(card); },
      cerrar: closeFicha,
      tarjeta: function () { return currentCard; },
      abierta: function () { return overlay.classList.contains('open'); },
      // Elegir un color en el bloque del pedido mueve la foto grande. Se
      // reengancha el índice para que las flechas de adentro sigan desde ahí y
      // no desde donde estaban antes de elegir.
      verFoto: function (src, alt) {
        var resuelta = mostrarFoto(src, alt);
        var i = fotos.indexOf(resuelta);
        if (i > -1) fotoIdx = i;
      },
      // Para tarjetas que no estaban en el HTML cuando este script corrió
      // (productos de catalogo_productos, insertados después por
      // assets/catalogo-productos.js): pcards/allCards son un snapshot
      // tomado una sola vez arriba, así que sin esto la tarjeta nunca abre
      // ficha y nunca entra en el prev/next de "Producto siguiente".
      registrar: function (card) {
        if (allCards.indexOf(card) === -1) allCards.push(card);
        card.addEventListener('click', function (e) {
          e.preventDefault();
          openFicha(card);
        });
      }
    };
    document.dispatchEvent(new CustomEvent('mm:ficha'));
  }

  /* --- Ficha técnica en la tarjeta: convierte data-specs en una lista
     vertical (un dato debajo del otro) y reemplaza el viejo subtítulo. --- */
  document.querySelectorAll('.pcard[data-specs]').forEach(function (card) {
    var body = card.querySelector('.pcard-body');
    if (!body) return;
    var lines = card.dataset.specs.split('|').map(function (s) { return s.trim(); })
      .filter(function (s) { return s; });
    if (!lines.length) return;
    var ul = document.createElement('ul');
    ul.className = 'specs';
    lines.forEach(function (l) {
      var li = document.createElement('li');
      li.textContent = l;
      ul.appendChild(li);
    });
    // Sacamos el subtítulo/descripción vieja para no duplicar info.
    body.querySelectorAll('.sub, .pdesc').forEach(function (e) { e.remove(); });
    var h3 = body.querySelector('h3');
    if (h3) h3.insertAdjacentElement('afterend', ul);
    else body.insertBefore(ul, body.firstChild);
  });

  /* --- Galería de producto: flechas/puntos para ver cada color ---
   * Separada en su propia función (y expuesta como window.MMGaleria.registrar)
   * para que assets/catalogo-productos.js pueda armar la misma navegación en
   * una tarjeta de galería insertada DESPUÉS de que este bucle ya corrió —
   * mismo motivo que MMFicha.registrar más arriba. */
  function armarGaleria(card) {
    var track = card.querySelector('.gtrack');
    if (!track) return;
    var slides = track.querySelectorAll('img');
    if (slides.length < 2) return;
    var dots = card.querySelectorAll('.gdot');
    var cap = card.querySelector('.gcap');

    // Contador "1/3" en la esquina: hace evidente, sin pasar el mouse, que
    // la foto es un carrusel con más de una imagen detrás.
    var count = document.createElement('span');
    count.className = 'gcount';
    count.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 21h14V7"/></svg><b></b>';
    card.querySelector('.pcard-ph').appendChild(count);
    var countNum = count.querySelector('b');
    countNum.textContent = '1/' + slides.length;

    var i = 0;
    var show = function (n) {
      i = (n + slides.length) % slides.length;
      track.style.transform = 'translateX(' + (-i * 100) + '%)';
      dots.forEach(function (d, idx) { d.classList.toggle('is-on', idx === i); });
      if (cap) cap.textContent = slides[i].getAttribute('data-cap') || '';
      countNum.textContent = (i + 1) + '/' + slides.length;
    };
    var go = function (e, target) { e.preventDefault(); e.stopPropagation(); show(target); };
    var prev = card.querySelector('.gprev');
    var next = card.querySelector('.gnext');
    if (prev) prev.addEventListener('click', function (e) { go(e, i - 1); });
    if (next) next.addEventListener('click', function (e) { go(e, i + 1); });
    dots.forEach(function (d, idx) {
      d.addEventListener('click', function (e) { go(e, idx); });
    });
  }
  document.querySelectorAll('.pcard.has-gallery').forEach(armarGaleria);
  window.MMGaleria = { registrar: armarGaleria };

  /* --- Buscador por categoría: filtra las tarjetas de la página en vivo --- */
  var searchInput = document.getElementById('catSearch');
  if (searchInput) {
    var searchCards = Array.prototype.slice.call(document.querySelectorAll('.catsec .pcard'));
    var searchSecs = Array.prototype.slice.call(document.querySelectorAll('.catsec'));
    var clearBtn = document.querySelector('.catsearch-clear');
    var main = document.querySelector('main');

    // Quita acentos y pasa a minúsculas para comparar sin importar tildes.
    var norm = function (s) {
      return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    // Texto buscable de cada tarjeta: nombre + variantes + descripción +
    // categoría + título de su sección (así "fiesta" trae los de esa sección).
    searchCards.forEach(function (card) {
      var parts = [];
      var h3 = card.querySelector('h3');
      var sub = card.querySelector('.sub');
      var pdesc = card.querySelector('.pdesc');
      var sec = card.closest('.catsec');
      var secH2 = sec && sec.querySelector('.catsec-head h2');
      if (h3) parts.push(h3.textContent);
      if (sub) parts.push(sub.textContent);
      if (pdesc) parts.push(pdesc.textContent);
      if (card.dataset.specs) parts.push(card.dataset.specs.replace(/\|/g, ' '));
      if (card.dataset.desc) parts.push(card.dataset.desc);
      if (card.dataset.cat) parts.push(card.dataset.cat);
      if (secH2) parts.push(secH2.textContent);
      card._hay = norm(parts.join(' '));
    });

    // Cartel de "sin resultados" (se crea una sola vez).
    var emptyEl = document.createElement('div');
    emptyEl.className = 'catsearch-empty is-filtered-out';
    emptyEl.setAttribute('aria-live', 'polite');
    emptyEl.innerHTML = '<b>Sin resultados</b><span>No encontramos productos con esa búsqueda. Probá con otra palabra o escribinos por WhatsApp.</span>';
    if (main) main.appendChild(emptyEl);

    var noResultsTimer = null;

    var applySearch = function () {
      var raw = searchInput.value.trim();
      if (clearBtn) clearBtn.hidden = !raw;
      var q = norm(raw);
      clearTimeout(noResultsTimer);

      if (!q) {
        searchCards.forEach(function (c) { c.classList.remove('is-filtered-out'); });
        searchSecs.forEach(function (s) { s.classList.remove('is-filtered-out'); });
        emptyEl.classList.add('is-filtered-out');
        return;
      }

      var terms = q.split(/\s+/);
      var anyMatch = false;
      searchCards.forEach(function (c) {
        var match = terms.every(function (t) { return c._hay.indexOf(t) !== -1; });
        c.classList.toggle('is-filtered-out', !match);
        if (match) { c.classList.add('is-visible'); anyMatch = true; }  // forzar reveal
      });
      // Ocultar secciones que quedaron sin ninguna tarjeta visible.
      searchSecs.forEach(function (s) {
        var visible = s.querySelector('.pcard:not(.is-filtered-out)');
        s.classList.toggle('is-filtered-out', !visible);
      });
      emptyEl.classList.toggle('is-filtered-out', anyMatch);

      // Recién a los 800ms (dejamos de tipear): evita mandar un evento por
      // cada letra mientras la búsqueda todavía "no dio con nada" a medias.
      if (!anyMatch) {
        noResultsTimer = setTimeout(function () {
          trackGA('catsearch_no_results', { search_term: raw, page_path: location.pathname });
        }, 800);
      }
    };

    searchInput.addEventListener('input', applySearch);
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && searchInput.value) { searchInput.value = ''; applySearch(); }
    });
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        searchInput.value = '';
        applySearch();
        searchInput.focus();
      });
    }
    applySearch();
  }

  /* --- Nav: fondo sólido al bajar --- */
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('solid', window.scrollY > 16); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --- Menú móvil --- */
  var toggle = document.querySelector('.nav-toggle');
  var links = document.getElementById('nav-links');
  if (toggle && links) {
    var setOpen = function (open) {
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    // Cerrar al elegir un link o apretar Escape
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
    // Cerrar si se agranda la ventana a escritorio
    window.addEventListener('resize', function () {
      if (window.innerWidth > 820) setOpen(false);
    });
  }

  /* --- Aparición al hacer scroll --- */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var items = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* --- Tarjetas 3D (Nuestros mundos): inclinación siguiendo el mouse --- */
  if (!reduce && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    var cards = document.querySelectorAll('.mundo');
    cards.forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;   // -0.5 .. 0.5
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transition = 'transform .12s ease-out, box-shadow .28s ease';
        card.style.transform =
          'translateY(-10px) scale(1.02) rotateX(' + (-py * 9).toFixed(2) + 'deg) rotateY(' + (px * 11).toFixed(2) + 'deg)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transition = '';
        card.style.transform = '';
      });
    });
  }

  /* --- Imagen Historia: tilt 3D al mover el mouse --- */
  if (!reduce && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    var histImg = document.getElementById('histImg');
    if (histImg && !histImg.querySelector('canvas')) {
      histImg.addEventListener('pointermove', function (e) {
        var r = histImg.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        histImg.style.transition = 'transform .1s ease-out, box-shadow .2s ease';
        histImg.style.transform =
          'rotateX(' + (-py * 11).toFixed(2) + 'deg) rotateY(' + (px * 13).toFixed(2) + 'deg) translateY(-6px) scale(1.015)';
        histImg.style.boxShadow =
          '0 2px 0 rgba(255,255,255,.9) inset, 0 40px 64px -22px rgba(20,18,16,.36), 0 14px 28px -14px rgba(20,18,16,.20)';
      });
      histImg.addEventListener('pointerleave', function () {
        histImg.style.transition = '';
        histImg.style.transform = '';
        histImg.style.boxShadow = '';
      });
    }
  }

  /* --- Contadores animados (sección Historia) --- */
  var counters = document.querySelectorAll('.hstat .num[data-count]');
  var staticNums = document.querySelectorAll('.hstat .num[data-static]');
  staticNums.forEach(function (el) { el.innerHTML = el.dataset.static; });
  if (counters.length) {
    var cntIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = +el.dataset.count;
        var suffix = el.dataset.suffix || '';
        var duration = 1400;
        var start = null;
        function step(ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / duration, 1);
          var ease = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.floor(ease * target) + suffix;
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        cntIO.unobserve(el);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cntIO.observe(el); });
  }
})();
