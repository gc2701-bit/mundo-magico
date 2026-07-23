/* Mundo Mágico · buscador global
   Un ícono en el nav abre un panel que busca en TODO el catálogo (no solo la
   página actual) y lleva directo a donde vive cada producto. Usa el mismo
   snapshot que ya arma .claude/gen-explorar-data.js para explorar.html. */
(function () {
  'use strict';

  var nav = document.getElementById('nav');
  if (!nav) return; // páginas sin nav estándar (explorar.html) quedan afuera

  // Nombre lindo + color por página, mismos 8 mundos que index.html + Especiales.
  var PAGE_META = {
    'globos-fiesta-v2.html': { label: 'Cotillón',               color: '#2f63cf' },
    'cumpleanos-v2.html':    { label: 'Cumpleaños',             color: '#e23b30' },
    'disfraces-v2.html':     { label: 'Disfraces y accesorios', color: '#a23e8c' },
    'reposteria-v2.html':    { label: 'Repostería',             color: '#ec6a9c' },
    'decoracion-v2.html':    { label: 'Decoración del hogar',   color: '#6f9e5b' },
    'combos-v2.html':        { label: 'Combos',                 color: '#f0913a' },
    'especiales-v2.html':    { label: 'Especiales',             color: '#3b82c4' }
  };

  // Quita acentos y pasa a minúsculas (mismo criterio que site.js, copiado
  // a propósito: no hay módulos en este sitio, cada script es independiente).
  var norm = function (s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  };

  var index = null;   // se arma una sola vez, la primera vez que se abre
  var loading = false;

  /* ---- Botón disparador, inyectado como un link más dentro de .nav-links
     (así aparece en el menú de escritorio Y adentro del menú móvil, sin tocar
     el layout de 2 columnas logo/links que ya tiene .nav) ---- */
  var links = nav.querySelector('.nav-links');
  if (!links) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-search-btn';
  btn.setAttribute('aria-label', 'Buscar productos');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><span>Buscar</span>';
  var wa = links.querySelector('.wa');
  if (wa) wa.insertAdjacentElement('beforebegin', btn);
  else links.appendChild(btn);

  /* ---- Overlay, inyectado una sola vez (mismo patrón que la ficha de producto de site.js) ---- */
  var overlay = document.createElement('div');
  overlay.className = 'search-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Buscar productos');
  overlay.innerHTML =
    '<div class="search-panel">' +
      '<div class="search-field">' +
        '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
        '<input type="search" class="search-input" placeholder="Buscar en toda la tienda…" aria-label="Buscar productos" autocomplete="off">' +
        '<button type="button" class="search-close" aria-label="Cerrar">✕</button>' +
      '</div>' +
      '<div class="search-results" role="listbox"></div>' +
      '<div class="search-empty" hidden><b>Sin resultados</b><span>No encontramos productos con esa búsqueda. Probá con otra palabra o escribinos por WhatsApp.</span></div>' +
    '</div>';
  document.body.appendChild(overlay);

  var input = overlay.querySelector('.search-input');
  var resultsEl = overlay.querySelector('.search-results');
  var emptyEl = overlay.querySelector('.search-empty');
  var closeBtn = overlay.querySelector('.search-close');
  var activeIdx = -1;

  function open() {
    overlay.classList.add('open');
    document.body.classList.add('search-open');
    ensureIndex(function () { input.focus(); render([]); });
  }
  function close() {
    overlay.classList.remove('open');
    document.body.classList.remove('search-open');
    input.value = '';
    render([]);
    btn.focus();
  }

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  /* ---- Carga perezosa del snapshot global (solo la primera vez que se abre) ---- */
  function ensureIndex(cb) {
    if (index) return cb();
    if (window.__EXPLORAR_DATA__) { index = buildIndex(window.__EXPLORAR_DATA__); return cb(); }
    if (loading) return;
    loading = true;
    resultsEl.innerHTML = '<p class="search-loading">Cargando catálogo…</p>';
    var s = document.createElement('script');
    s.src = 'assets/explorar-data.js';
    s.onload = function () {
      loading = false;
      index = buildIndex(window.__EXPLORAR_DATA__ || {});
      resultsEl.innerHTML = '';
      cb();
    };
    s.onerror = function () {
      loading = false;
      resultsEl.innerHTML = '<p class="search-loading">No pudimos cargar el buscador. Probá recargar la página.</p>';
    };
    document.head.appendChild(s);
  }

  function buildIndex(data) {
    var flat = [];
    var byPage = {};
    Object.keys(data).forEach(function (page) {
      var meta = PAGE_META[page] || { label: page.replace('-v2.html', ''), color: '#888' };
      byPage[page] = [];
      (data[page] || []).forEach(function (p) {
        var hay = norm([p.title, (p.specs || []).join(' '), meta.label].join(' '));
        var item = {
          title: p.title,
          thumb: (p.images && p.images[0]) ? p.images[0].src : '',
          href: p.href || page,
          label: meta.label,
          color: meta.color,
          _titleNorm: norm(p.title),
          _hay: hay
        };
        flat.push(item);
        byPage[page].push(item);
      });
    });

    // Sugerencias por defecto (buscador vacío): un par de productos de cada
    // mundo, en el mismo orden que aparecen en el nav, para dar variedad.
    var defaults = [];
    var pages = Object.keys(PAGE_META).filter(function (pg) { return byPage[pg] && byPage[pg].length; });
    for (var round = 0; round < 2; round++) {
      pages.forEach(function (pg) {
        if (byPage[pg][round]) defaults.push(byPage[pg][round]);
      });
    }
    flat.defaults = defaults;
    return flat;
  }

  /* ---- Buscar: mismo algoritmo AND multi-término que site.js applySearch(),
     pero con las coincidencias ordenadas por relevancia antes de recortar a 40.
     Sin esto, con pocas letras (ej. "an") sobran coincidencias incidentales
     (globos, manual, tanque...) que tapan lo que el usuario realmente busca
     (anteojos), porque quedaban primero solo por su orden en el catálogo. ---- */
  function scoreMatch(p, terms) {
    var score = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var idx = p._titleNorm.indexOf(t);
      if (idx === -1) { score += 1; continue; } // solo matchea en specs/categoría
      var atWordStart = idx === 0 || p._titleNorm.charAt(idx - 1) === ' ';
      score += atWordStart ? (100 - idx) : 10;
    }
    return score;
  }

  function search(raw) {
    var q = norm(raw.trim());
    if (!q) return [];
    var terms = q.split(/\s+/);
    var matches = [];
    for (var i = 0; i < index.length; i++) {
      var p = index[i];
      if (terms.every(function (t) { return p._hay.indexOf(t) !== -1; })) {
        matches.push({ p: p, score: scoreMatch(p, terms), i: i });
      }
    }
    matches.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    var out = [];
    for (var j = 0; j < matches.length && out.length < 40; j++) out.push(matches[j].p);
    return out;
  }

  function renderItems(list) {
    list.forEach(function (p) {
      var a = document.createElement('a');
      a.className = 'search-result';
      a.href = p.href;
      a.setAttribute('role', 'option');
      a.innerHTML =
        '<img src="' + p.thumb + '" alt="" loading="lazy">' +
        '<span class="sr-body"><b></b>' +
        '<span class="sr-cat" style="--cat:' + p.color + '"></span></span>';
      a.querySelector('.sr-body b').textContent = p.title;
      a.querySelector('.sr-cat').textContent = p.label;
      resultsEl.appendChild(a);
    });
  }

  function render(list) {
    activeIdx = -1;
    resultsEl.innerHTML = '';
    resultsEl.classList.remove('is-suggestions');
    var hasQuery = !!input.value.trim();
    emptyEl.hidden = !hasQuery || list.length > 0;
    if (!hasQuery && !list.length) {
      // Todavía no escribió nada: mostrar sugerencias en vez de un panel vacío.
      resultsEl.classList.add('is-suggestions');
      var h = document.createElement('p');
      h.className = 'search-suggest-heading';
      h.textContent = 'Quizás te interesa';
      resultsEl.appendChild(h);
      renderItems((index && index.defaults) || []);
      return;
    }
    renderItems(list);
  }

  input.addEventListener('input', function () { render(index ? search(input.value) : []); });

  // Flechas + Enter para navegar los resultados sin mouse.
  input.addEventListener('keydown', function (e) {
    var items = resultsEl.querySelectorAll('.search-result');
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); }
    else if (e.key === 'Enter' && activeIdx >= 0) { items[activeIdx].click(); return; }
    else return;
    items.forEach(function (el, i) { el.classList.toggle('is-active', i === activeIdx); });
    if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
  });
})();
