/* Mundo Mágico · mega-menú de "Nuestros mundos"
   El desplegable del nav ya lista los mundos (mismo <a role="menuitem"> de
   siempre). Este script lo transforma en columnas: cada mundo arriba, sus
   subcategorías reales debajo, para poder ir directo sin entrar primero. */
(function () {
  'use strict';

  var dropdown = document.querySelector('.nav-dropdown');
  if (!dropdown) return;

  // Subcategorías por mundo: mismas etiquetas y anchors que ya tiene la
  // catbar de cada página (si cambian ahí, hay que actualizarlas acá también).
  var SUBCATS = {
    'globos-fiesta-v2.html': [
      { label: 'Luces y efectos', href: '#efectos' },
      { label: 'Sombreros y gorros', href: '#sombreros-gorros' },
      { label: 'Anteojos', href: '#anteojos' },
      { label: 'Mis 15', href: '#mis15' },
      { label: 'Novias', href: '#novias' }
    ],
    'cumpleanos-v2.html': [
      { label: 'Globos', href: '#globos' },
      { label: 'Cortinas', href: '#cortinas' },
      { label: 'Guirnaldas y banderines', href: '#guirnaldas' },
      { label: 'Toppers', href: '#toppers' },
      { label: 'Velas', href: '#velas' },
      { label: 'Líneas infantiles', href: '#licencias' }
    ],
    'disfraces-v2.html': [
      { label: 'Accesorios', href: '#accesorios' },
      { label: 'Los disfraces', href: '#disfraces' },
      { label: 'Acto patrio', href: '#acto-patrio' }
    ],
    'reposteria-v2.html': [
      { label: 'Para hornear', href: '#para-hornear' },
      { label: 'Moldes', href: '#moldes' },
      { label: 'Cortantes', href: '#cortantes' },
      { label: 'Manga y picos', href: '#manga-y-picos' },
      { label: 'La mesa dulce', href: '#la-mesa-dulce' },
      { label: 'Para regalar', href: '#para-regalar' }
    ],
    'decoracion-v2.html': [
      { label: 'Mesa y descartables', href: '#descartables' },
      { label: 'Puesta de mesa', href: '#puesta-de-mesa' },
      { label: 'Servilletas', href: '#servilletas' },
      { label: 'Repasadores', href: '#repasadores' },
      { label: 'Rincones', href: '#los-rincones' },
      { label: 'Floreros', href: '#floreros' },
      { label: 'Paredes', href: '#las-paredes' },
      { label: 'Textiles', href: '#textiles' }
    ]
    // combos-v2.html: sin subcategorías (una sola sección) — no hace falta entrada.
  };

  var items = Array.prototype.slice.call(dropdown.querySelectorAll('a[role="menuitem"]'));
  if (!items.length) return;

  dropdown.classList.add('nd-mega');
  var oldLabel = dropdown.querySelector('.nd-label');
  if (oldLabel) oldLabel.remove();
  var oldSep = dropdown.querySelector('.nd-sep');
  if (oldSep) oldSep.remove();

  // Netlify sirve las páginas con "Pretty URLs": reescribe href="foo.html" a
  // "/foo" en el HTML final. Sin normalizar, el lookup de acá abajo no
  // encuentra nada en producción (aunque en local, con el .html intacto,
  // funcione perfecto) y el menú queda sin subcategorías.
  function normalizeKey(href) {
    var h = href.replace(/^\//, '').replace(/\/$/, '');
    if (!/\.html?$/i.test(h)) h += '.html';
    return h;
  }

  // Crea (si hace falta) la flechita + el cajón de links de una columna, y
  // devuelve el cajón. Antes esto sólo pasaba si SUBCATS ya traía algo para
  // esa página al cargar — ahora también lo necesita una página que hoy no
  // tiene ninguna subcategoría pero a la que le crean la primera desde el
  // panel de admin (ej. combos-v2.html).
  function boxDe(col, headRow, a) {
    var box = col.querySelector('.nd-col-links');
    if (box) return box;

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nd-col-toggle';
    toggle.setAttribute('aria-label', 'Ver subcategorías de ' + a.textContent.trim());
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    headRow.appendChild(toggle);

    box = document.createElement('div');
    box.className = 'nd-col-links';
    col.appendChild(box);

    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      var open = col.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    return box;
  }

  // page (con ".html") → { col, headRow, a, existentes: {slug: true} } —
  // lo que arma el bucle de abajo, para poder completarlo después con lo
  // que traiga la base.
  var columnas = {};

  items.forEach(function (a) {
    var page = a.getAttribute('href');
    var key = normalizeKey(page);
    var subs = SUBCATS[key];

    var col = document.createElement('div');
    col.className = 'nd-col';
    a.classList.add('nd-col-head');
    a.parentNode.insertBefore(col, a);

    var headRow = document.createElement('div');
    headRow.className = 'nd-col-head-row';
    headRow.appendChild(a);
    col.appendChild(headRow);

    var existentes = {};
    if (subs && subs.length) {
      var box = boxDe(col, headRow, a);
      subs.forEach(function (s) {
        var sub = document.createElement('a');
        sub.href = page + s.href;
        sub.textContent = s.label;
        sub.setAttribute('role', 'menuitem');
        box.appendChild(sub);
        // s.href es "#slug" — mismo slug que guarda catalogo_subcategorias
        // para una subcategoría migrada desde el HTML (ver
        // .claude/gen-subcategorias-sql.js), así se puede cruzar con lo que
        // traiga MMCatalogo más abajo sin duplicar la entrada.
        existentes[s.href.slice(1)] = true;
      });
    }

    columnas[key] = { page: page, col: col, headRow: headRow, a: a, existentes: existentes };
  });

  // Las subcategorías creadas desde el panel de admin (Modo edición) no
  // están en SUBCATS — viven sólo en catalogo_subcategorias — así que sin
  // esto el desplegable de "Nuestros mundos" nunca las lista, aunque ya
  // tengan su propia sección y su link en la catbar de la página (ver
  // sincronizarCatbar() en assets/precios.js). Se completa async porque
  // MMCatalogo.cargar() siempre resuelve async (ver assets/catalogo.js).
  //
  // ESPERAR a DOMContentLoaded para recién ahí llamar a MMCatalogo.cargar()
  // no es cosmético: este script corre ANTES que assets/cuenta.js en el
  // <head>/<body> de cada página (cuenta.js crea el cliente de Supabase,
  // window.MMCuenta). Si esto llamara a cargar() de una, sería la PRIMERA
  // llamada de toda la carga de la página — MMCatalogo.resolver() vería
  // window.MMCuenta todavía sin existir, resolvería un catálogo vacío
  // (sin productos ni subcategorías de la web), y esa respuesta vacía
  // queda cacheada en memoria para el resto de la visita: hasta
  // catalogo-productos.js, que sí espera a DOMContentLoaded, recibiría esa
  // misma respuesta ya resuelta y ninguno de los productos/subcategorías
  // cargados desde el panel llegaría a mostrarse en toda la página.
  // Sólo tiene sentido para una subcategoría 100% nacida en la base (nunca
  // para una migrada del HTML, ver la nota grande más abajo): como no viene
  // de ninguna <section> propia, TODO lo que tiene adentro quedó anotado en
  // la base al asignársela (subcategoria_id, en catalogo_productos o en el
  // override de catalogo_tarjetas) — así que si no hay ningún producto
  // publicado ni ninguna tarjeta sin ocultar con ese id, está vacía de
  // verdad, en cualquier mundo donde se mire.
  function tieneAlgoVisible(subId, datos) {
    var productos = datos.productos || [];
    for (var i = 0; i < productos.length; i++) {
      if (productos[i].subcategoriaId === subId) return true;
    }
    var tarjetas = datos.tarjetas || {};
    for (var clave in tarjetas) {
      if (tarjetas[clave].subcategoriaId === subId && !tarjetas[clave].oculta) return true;
    }
    return false;
  }

  function completarConSubcategorias() {
    if (!window.MMCatalogo) return;
    MMCatalogo.cargar(function (datos) {
      var subcategorias = datos.subcategorias || {};
      var porPagina = {};
      for (var id in subcategorias) {
        var s = Object.assign({ id: id }, subcategorias[id]);
        (porPagina[s.pagina] || (porPagina[s.pagina] = [])).push(s);
      }
      for (var key in porPagina) {
        var info = columnas[key];
        if (!info) continue; // mundo sin entrada en el nav (no debería pasar)
        var lista = porPagina[key].slice().sort(function (x, y) {
          return (x.orden - y.orden) || x.nombre.localeCompare(y.nombre);
        });
        // Las migradas del HTML (ya están en info.existentes) se dejan
        // siempre, vacías o no: este script corre en CUALQUIER página del
        // sitio, no en la dueña de esa <section>, así que no hay forma de
        // saber desde acá si sus tarjetas (la mayoría sin ninguna fila en
        // la base) siguen teniendo algo visible o no — sólo la propia
        // página sabe eso (ver sincronizarCatbar() en precios.js). Filtrar
        // "a ciegas" podría esconder una categoría que en realidad está
        // llena. Las nacidas 100% en la base sí se pueden chequear del
        // todo (tieneAlgoVisible arriba) porque no tienen ese punto ciego.
        var nuevas = lista.filter(function (s) {
          return !info.existentes[s.slug] && tieneAlgoVisible(s.id, datos);
        });
        if (!nuevas.length) continue;
        var box = boxDe(info.col, info.headRow, info.a);
        nuevas.forEach(function (s) {
          var sub = document.createElement('a');
          // "cat-" + slug: mismo id que crearSeccion() le da a una sección
          // nacida 100% del navegador (nunca "el slug tal cual", que es
          // sólo para las migradas desde el HTML — esas ya están en
          // info.existentes y se filtraron arriba).
          sub.href = info.page + '#cat-' + s.slug;
          sub.textContent = s.nombre;
          sub.setAttribute('role', 'menuitem');
          box.appendChild(sub);
          info.existentes[s.slug] = true;
        });
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', completarConSubcategorias);
  else completarConSubcategorias();
})();
