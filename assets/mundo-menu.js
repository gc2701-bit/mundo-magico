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
      { label: 'Globos', href: '#globos' },
      { label: 'Cortinas y telas', href: '#cortinas' },
      { label: 'Guirnaldas y banderines', href: '#guirnaldas' },
      { label: 'Luces y efectos', href: '#efectos' }
    ],
    'cumpleanos-v2.html': [
      { label: 'Decorá el cumple', href: '#decorar' },
      { label: 'La torta y sus velas', href: '#la-torta' },
      { label: 'Líneas infantiles', href: '#licencias' }
    ],
    'disfraces-v2.html': [
      { label: 'Los disfraces', href: '#disfraces' },
      { label: 'Acto patrio', href: '#acto-patrio' },
      { label: 'Para la fiesta', href: '#para-la-fiesta' },
      { label: 'Sombreros y gorros', href: '#sombreros-gorros' },
      { label: 'Anteojos', href: '#anteojos' },
      { label: 'Mis 15', href: '#mis15' },
      { label: 'Novias', href: '#novias' }
    ],
    'reposteria-v2.html': [
      { label: 'Para hornear', href: '#para-hornear' },
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

  items.forEach(function (a) {
    var page = a.getAttribute('href');
    var subs = SUBCATS[page];

    var col = document.createElement('div');
    col.className = 'nd-col';
    a.classList.add('nd-col-head');
    a.parentNode.insertBefore(col, a);
    col.appendChild(a);

    if (subs && subs.length) {
      var box = document.createElement('div');
      box.className = 'nd-col-links';
      subs.forEach(function (s) {
        var sub = document.createElement('a');
        sub.href = page + s.href;
        sub.textContent = s.label;
        sub.setAttribute('role', 'menuitem');
        box.appendChild(sub);
      });
      col.appendChild(box);
    }
  });
})();
