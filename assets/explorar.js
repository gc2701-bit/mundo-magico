/* ==========================================================================
   Explorar · feed inmersivo tipo reel
   Lee las páginas de categoría existentes (fuente única de verdad), extrae los
   productos y arma un feed vertical a pantalla completa con scroll-snap.
   ========================================================================== */
(function () {
  'use strict';

  var WA = '5493813006343';

  // Categoría -> página de origen, color de acento y video de portada (si tiene).
  var CATS = [
    { name: 'Cotillón',   page: 'cotillon-v2.html',   color: '#2f63cf', video: 'Header categories/Header-2-Cotillon.mp4', tagline: 'Todo para que la fiesta explote de color.' },
    { name: 'Cumpleaños', page: 'cumpleanos-v2.html', color: '#e23b30', video: 'Header categories/Cumpleaños-2.mp4',       tagline: 'Velas, números y globos para el gran día.' },
    { name: 'Repostería', page: 'reposteria-v2.html', color: '#ec6a9c', video: 'Header categories/Reposteria-3.mp4',       tagline: 'Toppers, wafers y todo para decorar la torta.' },
    { name: 'Decoración', page: 'decoracion-v2.html', color: '#6f9e5b', video: 'Header categories/Deco-2.mp4',             tagline: 'Detalles lindos para tu casa y tu mesa.' },
    { name: 'Disfraces',  page: 'disfraces-v2.html',  color: '#7c4dd6', video: 'Header categories/Disfraces - web.mp4',    tagline: 'Para actos, fechas patrias y personajes.' },
    { name: 'Combos',     page: 'combos-v2.html',     color: '#f0913a', video: null, tagline: 'La fiesta resuelta en un solo pack.' },
    { name: 'Especiales', page: 'especiales-v2.html', color: '#4aa3e0', video: null, tagline: 'Selección Argentina y ediciones especiales.' }
  ];

  var reel, chipsWrap, counterEl, toastEl, backdropEl;
  var products = [];          // todos los productos cargados
  var slidesIO, activeIO;     // observers: hidratar media / marcar activa
  var currentCat = null;      // null = "Descubrir" (mezcla)
  var pinnedId = null;        // producto a mostrar primero (link compartido)

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    reel = document.getElementById('reel');
    chipsWrap = document.getElementById('chips');
    counterEl = document.getElementById('counter');
    backdropEl = document.getElementById('backdrop');
    if (!reel) return;

    // Si vienen desde un link compartido (?p=...), arrancamos por ese producto.
    var params = new URLSearchParams(window.location.search);
    pinnedId = params.get('p');

    buildChips();
    setupObservers();
    setupWheelNav();
    loadAll();
  }

  /* ---------- Carga y parseo de las páginas de categoría ---------- */
  function loadAll() {
    var jobs = CATS.map(function (cat) {
      return fetch(cat.page)
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (html) { return html ? parsePage(cat, html) : []; })
        .catch(function () { return []; });   // si falla una, se omite y sigue
    });

    Promise.all(jobs).then(function (lists) {
      products = [];
      lists.forEach(function (list) { products = products.concat(list); });
      // Al abrir el archivo local (file://) fetch está bloqueado y no llega nada:
      // usamos el snapshot embebido en assets/explorar-data.js como respaldo.
      if (!products.length) products = loadFromSnapshot();
      if (!products.length) { showEmpty(); return; }
      render();
    });
  }

  // Respaldo sin red: arma los productos desde window.__EXPLORAR_DATA__
  // (generado por .claude/gen-explorar-data.js).
  function loadFromSnapshot() {
    var data = window.__EXPLORAR_DATA__;
    if (!data) return [];
    var all = [];
    CATS.forEach(function (cat) {
      var list = data[cat.page];
      if (!list || !list.length) return;
      list.forEach(function (o) {
        if (o.images && o.images.length) all.push(finalizeProduct(cat, o));
      });
    });
    return all;
  }

  function parsePage(cat, html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var cards = doc.querySelectorAll('a.pcard');
    var out = [];
    cards.forEach(function (card) {
      var ph = card.querySelector('.pcard-ph');
      if (!ph) return;
      var images = [];
      ph.querySelectorAll('img').forEach(function (im) {
        var src = im.getAttribute('src');
        if (src) images.push({ src: src, cap: im.getAttribute('data-cap') || '', alt: im.getAttribute('alt') || '' });
      });
      if (!images.length) return;

      var h3 = card.querySelector('h3');
      var title = h3 ? h3.textContent.trim() : (images[0].alt || '');

      var specs = [];
      var dataSpecs = card.getAttribute('data-specs');
      if (dataSpecs) {
        specs = dataSpecs.split('|').map(function (s) { return s.trim(); }).filter(Boolean);
      } else {
        var sub = card.querySelector('.sub');
        if (sub) specs = [sub.textContent.trim()];
      }
      // El precio suele venir pegado al final del .sub o en data-price/.pricetag.
      var price = card.getAttribute('data-price') || '';
      if (!price) {
        var tag = ph.querySelector('.pricetag');
        if (tag) price = tag.textContent.trim();
      }

      out.push(finalizeProduct(cat, {
        title: title, images: images, specs: specs, price: price,
        wamsg: card.getAttribute('data-wamsg') || ''
      }));
    });
    return out;
  }

  // Completa un producto (id + mensaje de WhatsApp por defecto) a partir de los
  // campos crudos. La usan tanto el parseo en vivo como el snapshot.
  function finalizeProduct(cat, o) {
    var wamsg = o.wamsg ||
      ('¡Hola Mundo Mágico! Me interesa "' + o.title + '"' + (o.price ? (' (' + o.price + ')') : '') + '. ¿Me pasás más info?');
    return {
      id: cat.page + '~' + slug(o.title),
      cat: cat,
      title: o.title,
      images: o.images,
      specs: o.specs || [],
      price: o.price || '',
      wamsg: wamsg
    };
  }

  /* ---------- Chips de categoría ---------- */
  function buildChips() {
    var frag = document.createDocumentFragment();
    frag.appendChild(makeChip('Descubrir', null));
    CATS.forEach(function (cat) { frag.appendChild(makeChip(cat.name, cat)); });
    chipsWrap.appendChild(frag);
  }

  function makeChip(label, cat) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (cat === currentCat ? ' is-on' : '');
    b.textContent = label;
    if (cat) b.style.setProperty('--cat', cat.color);
    b.addEventListener('click', function () {
      currentCat = cat;
      chipsWrap.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-on'); });
      b.classList.add('is-on');
      render();
      reel.scrollTo({ top: 0 });
    });
    return b;
  }

  /* ---------- Armado del feed ---------- */
  function buildFeed() {
    if (!currentCat) {
      // Modo Descubrir: mezcla de todas las categorías.
      var mix = shuffle(products.slice());
      // Si llegaron por un link compartido, ese producto va primero (una vez).
      if (pinnedId) {
        var idx = mix.findIndex(function (p) { return p.id === pinnedId; });
        if (idx > 0) { var pinned = mix.splice(idx, 1)[0]; mix.unshift(pinned); }
        pinnedId = null;
      }
      return mix;
    }
    // Categoría elegida: intro con video (si tiene) + sus productos.
    var list = products.filter(function (p) { return p.cat === currentCat; });
    var feed = [];
    if (currentCat.video) feed.push({ intro: currentCat });
    return feed.concat(list);
  }

  function render() {
    // limpiar observadores previos
    reel.querySelectorAll('.slide').forEach(function (s) {
      if (slidesIO) slidesIO.unobserve(s);
      if (activeIO) activeIO.unobserve(s);
    });
    reel.innerHTML = '';

    var feed = buildFeed();
    var total = feed.filter(function (x) { return !x.intro; }).length;
    var n = 0;
    feed.forEach(function (item) {
      var slide = item.intro ? buildIntro(item.intro) : buildSlide(item, ++n, total);
      reel.appendChild(slide);
      slidesIO.observe(slide);
      activeIO.observe(slide);
    });
    updateCounter(feed.length ? 1 : 0, total);
  }

  /* ---------- Slides ---------- */
  function buildSlide(p, index, total) {
    var slide = document.createElement('section');
    slide.className = 'slide';
    slide.style.setProperty('--cat', p.cat.color);
    slide.dataset.pos = index;
    slide.dataset.total = total;
    slide._product = p;   // se hidrata al acercarse al viewport
    return slide;
  }

  function hydrate(slide) {
    if (slide._hydrated || !slide._product) return;
    slide._hydrated = true;
    var p = slide._product;
    var first = p.images[0];

    var bg = document.createElement('div');
    bg.className = 'slide-bg';
    bg.style.backgroundImage = 'url("' + p.images[0].src + '")';

    // Carrusel de fotos: una fila deslizable con todas las variantes.
    var media = document.createElement('div');
    media.className = 'slide-media';
    var carousel = document.createElement('div');
    carousel.className = 'media-carousel';
    var track = document.createElement('div');
    track.className = 'media-track';
    p.images.forEach(function (im) {
      var cell = document.createElement('div');
      cell.className = 'media-cell';
      var cimg = document.createElement('img');
      cimg.src = im.src;
      cimg.alt = im.alt || p.title;
      cimg.loading = 'lazy';
      cimg.decoding = 'async';
      cell.appendChild(cimg);
      track.appendChild(cell);
    });
    carousel.appendChild(track);
    media.appendChild(carousel);

    var info = document.createElement('div');
    info.className = 'slide-info';
    var CLAMP = 2;   // renglones de descripción visibles antes de "Leer más"
    var html = '<span class="cat-chip">' + esc(p.cat.name) + '</span>' +
               '<h2>' + esc(p.title) + '</h2>';
    if (p.specs.length) {
      var clamp = p.specs.length > CLAMP;
      html += '<ul class="specs' + (clamp ? ' is-clamped' : '') + '">' +
        p.specs.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
      if (clamp) html += '<button type="button" class="readmore">Leer más</button>';
    }
    if (p.price) html += '<div class="slide-price">' + esc(p.price) + '</div>';
    info.innerHTML = html;

    // "Leer más": muestra/oculta el resto de la descripción.
    var readmore = info.querySelector('.readmore');
    if (readmore) {
      readmore.addEventListener('click', function () {
        var ul = info.querySelector('.specs');
        var open = ul.classList.toggle('is-open');
        ul.classList.toggle('is-clamped', !open);
        readmore.textContent = open ? 'Leer menos' : 'Leer más';
      });
    }

    // Galería de colores: fila de puntos + nombre del color, dentro de la info
    // (arriba del chip). Los puntos y el gesto de deslizar comparten showImage().
    var cur = 0;
    var dotEls = [];
    var capEl = null;

    function showImage(i) {
      i = Math.min(Math.max(i, 0), p.images.length - 1);
      cur = i;
      var im = p.images[i];
      track.style.transform = 'translateX(-' + (i * 100) + '%)';
      bg.style.backgroundImage = 'url("' + im.src + '")';
      if (backdropEl && slide.classList.contains('is-active')) {
        backdropEl.style.backgroundImage = 'url("' + im.src + '")';
      }
      if (capEl) capEl.textContent = im.cap || '';
      dotEls.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
    }

    if (p.images.length > 1) {
      var gallery = document.createElement('div');
      gallery.className = 'slide-gallery';
      var dots = document.createElement('div');
      dots.className = 'slide-dots';
      capEl = document.createElement('span');
      capEl.className = 'slide-cap';
      capEl.textContent = first.cap || '';
      p.images.forEach(function (im, i) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'sdot' + (i === 0 ? ' is-on' : '');
        d.setAttribute('aria-label', im.cap || ('Foto ' + (i + 1)));
        d.addEventListener('click', function () { showImage(i); });
        dots.appendChild(d);
        dotEls.push(d);
      });
      gallery.appendChild(dots);
      gallery.appendChild(capEl);
      info.insertBefore(gallery, info.firstChild);

      // Deslizar la foto: arrastre horizontal sobre el carrusel.
      enableSwipe(carousel, track, p.images.length, function () { return cur; }, showImage);
    }

    var actions = document.createElement('div');
    actions.className = 'slide-actions';

    var cta = document.createElement('a');
    cta.className = 'wa-cta';
    cta.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(p.wamsg);
    cta.target = '_blank';
    cta.rel = 'noopener';
    cta.innerHTML = waIcon() + 'Consultar por WhatsApp';
    actions.appendChild(cta);

    var share = document.createElement('button');
    share.type = 'button';
    share.className = 'share-btn';
    share.setAttribute('aria-label', 'Compartir este producto');
    share.innerHTML = shareIcon() + '<span>Compartir</span>';
    share.addEventListener('click', function () { shareProduct(p); });
    actions.appendChild(share);

    info.appendChild(actions);

    slide.appendChild(bg);
    slide.appendChild(media);
    slide.appendChild(info);
  }

  function dehydrate(slide) {
    if (!slide._hydrated || !slide._product) return;
    slide._hydrated = false;
    slide.innerHTML = '';
  }

  // Arrastre horizontal del carrusel de fotos. Bloquea el eje en el primer
  // movimiento: si es más horizontal cambia de foto; si es vertical, deja
  // pasar el scroll del reel intacto.
  function enableSwipe(carousel, track, count, getCur, go) {
    var downX = 0, downY = 0, w = 0;
    var active = false, decided = false, horiz = false;

    carousel.addEventListener('pointerdown', function (e) {
      if (count < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
      active = true; decided = false; horiz = false;
      downX = e.clientX; downY = e.clientY;
      w = carousel.clientWidth || 1;
      track.style.transition = 'none';
    });

    carousel.addEventListener('pointermove', function (e) {
      if (!active) return;
      var dx = e.clientX - downX, dy = e.clientY - downY;
      if (!decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        decided = true;
        horiz = Math.abs(dx) > Math.abs(dy);
        if (horiz) { try { carousel.setPointerCapture(e.pointerId); } catch (err) {} }
      }
      if (!horiz) return;
      var cur = getCur();
      var off = dx;
      // Resistencia en los extremos (no hay foto más allá).
      if ((cur === 0 && dx > 0) || (cur === count - 1 && dx < 0)) off = dx * 0.35;
      track.style.transform = 'translateX(calc(' + (-cur * 100) + '% + ' + off + 'px))';
    });

    function end(e) {
      if (!active) return;
      active = false;
      track.style.transition = '';
      if (!horiz) return;
      var dx = e.clientX - downX;
      var cur = getCur();
      var threshold = Math.min(60, w * 0.18);
      if (dx <= -threshold) go(cur + 1);
      else if (dx >= threshold) go(cur - 1);
      else go(cur);   // no alcanzó el umbral: vuelve a su lugar
    }
    carousel.addEventListener('pointerup', end);
    carousel.addEventListener('pointercancel', end);
  }

  function buildIntro(cat) {
    var slide = document.createElement('section');
    slide.className = 'slide slide-intro';
    slide.style.setProperty('--cat', cat.color);
    slide._intro = cat;
    var v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', '');
    v.preload = 'none';
    v.dataset.src = encodeURI(cat.video);
    var info = document.createElement('div');
    info.className = 'intro-info';
    info.innerHTML = '<span class="eyebrow-cat">Mundo</span><h2>' + esc(cat.name) + '</h2><p>' + esc(cat.tagline || '') + '</p><span class="intro-cue">Deslizá para ver ↑</span>';
    slide.appendChild(v);
    slide.appendChild(info);
    return slide;
  }

  /* ---------- Observers: hidratar media y marcar slide activa ---------- */
  function setupObservers() {
    // Hidratar la slide y sus vecinas; liberar las lejanas.
    slidesIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (e.target._intro) loadIntroVideo(e.target);
          else hydrate(e.target);
        }
      });
    }, { root: reel, rootMargin: '150% 0px', threshold: 0 });

    // Slide "activa" (la que ocupa la pantalla): actualiza contador y reproduce video.
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activeIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var vid = e.target.querySelector('video');
        if (e.intersectionRatio >= 0.6) {
          e.target.classList.add('is-active');
          if (e.target.dataset.pos) updateCounter(+e.target.dataset.pos, +e.target.dataset.total);
          if (vid && !reduce) { vid.play().catch(function () {}); }
          setBackdrop(e.target);
        } else {
          e.target.classList.remove('is-active');
          if (vid) vid.pause();
        }
      });
    }, { root: reel, threshold: [0, 0.6, 1] });
  }

  // Fondo ambiental (desktop): copia difuminada de la foto activa para llenar
  // el espacio a los costados de la columna.
  function setBackdrop(slide) {
    if (!backdropEl) return;
    var src = null;
    if (slide._product) src = slide._product.images[0].src;
    if (src) backdropEl.style.backgroundImage = 'url("' + src + '")';
  }

  function loadIntroVideo(slide) {
    var v = slide.querySelector('video');
    if (v && !v.src && v.dataset.src) {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduce) { v.src = v.dataset.src; }
    }
  }

  /* ---------- Contador ---------- */
  function updateCounter(pos, total) {
    if (!counterEl) return;
    counterEl.textContent = total ? (pos + ' / ' + total) : '';
  }

  /* ---------- Navegación por slide (teclado + rueda en escritorio) ----------
     En vez de dejar que la rueda/trackpad frene "donde sea", cada gesto avanza
     exactamente una slide y aterriza centrado — como un reel de verdad. */
  function slideList() {
    return Array.prototype.slice.call(reel.querySelectorAll('.slide'));
  }
  function currentIndex(slides) {
    var mid = reel.scrollTop + reel.clientHeight / 2;
    var cur = 0;
    slides.forEach(function (s, i) { if (s.offsetTop <= mid) cur = i; });
    return cur;
  }
  function goRelative(dir) {
    var slides = slideList();
    if (!slides.length) return;
    var next = Math.min(Math.max(currentIndex(slides) + dir, 0), slides.length - 1);
    // Scroll a la posición EXACTA de la slide (no dejamos que la inercia decida).
    reel.scrollTo({ top: slides[next].offsetTop, behavior: 'smooth' });
  }

  document.addEventListener('keydown', function (e) {
    if (!reel) return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' &&
        e.key !== 'PageDown' && e.key !== 'PageUp') return;
    if (!reel.querySelector('.slide')) return;
    e.preventDefault();
    goRelative(e.key === 'ArrowDown' || e.key === 'PageDown' ? 1 : -1);
  });

  // Rueda/trackpad: solo en punteros finos (escritorio). En táctil dejamos el
  // scroll nativo con snap, que ya se siente natural. Se llama desde init(),
  // cuando el elemento .reel ya existe.
  function setupWheelNav() {
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!finePointer || !reel) return;
    // En escritorio el JS controla el aterrizaje exacto, así que apagamos el
    // scroll-snap nativo: si no, "pelea" contra la animación suave y frena a medias.
    reel.style.scrollSnapType = 'none';
    var wheelLocked = false;
    var wheelAccum = 0;
    var wheelReset;
    reel.addEventListener('wheel', function (e) {
      e.preventDefault();                 // evita el scroll libre que deja a medias
      if (wheelLocked) return;
      // Acumula hasta superar un umbral para no disparar con micro-movimientos,
      // y se reinicia si el usuario deja de mover la rueda un instante.
      wheelAccum += e.deltaY;
      clearTimeout(wheelReset);
      wheelReset = setTimeout(function () { wheelAccum = 0; }, 200);
      if (Math.abs(wheelAccum) < 24) return;
      var dir = wheelAccum > 0 ? 1 : -1;
      wheelAccum = 0;
      wheelLocked = true;
      goRelative(dir);
      setTimeout(function () { wheelLocked = false; }, 480);
    }, { passive: false });
  }

  /* ---------- Compartir producto ---------- */
  function shareProduct(p) {
    var url = window.location.origin + window.location.pathname + '?p=' + encodeURIComponent(p.id);
    var data = {
      title: 'Mundo Mágico',
      text: p.title + ' · Mundo Mágico',
      url: url
    };
    // Celular: menú nativo (WhatsApp, Instagram, etc.).
    if (navigator.share) {
      navigator.share(data).catch(function () {});
      return;
    }
    // Escritorio: copiar el link al portapapeles + aviso.
    copyText(url).then(function (ok) {
      showToast(ok ? '¡Link copiado! Ya lo podés pegar donde quieras.' : 'No pudimos copiar el link.');
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'reel-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  /* ---------- Utilidades ---------- */
  function slug(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function esc(s) {
    return (s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function waIcon() {
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="20" height="20"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 1 1 6.97 3.86Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.57.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z"/></svg>';
  }

  function shareIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="18" height="18"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
  }

  function showEmpty() {
    reel.innerHTML = '<section class="slide slide-empty">' +
      '<div class="intro-info"><h2>No pudimos cargar los productos</h2>' +
      '<p>Probá recargar la página o mirá el catálogo completo.</p>' +
      '<a class="wa-cta" href="index.html">Volver al inicio</a></div></section>';
  }
})();
