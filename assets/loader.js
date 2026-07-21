/* Mundo Mágico · barra de carga entre páginas
   El sitio navega con recargas de página real (no es una SPA), así que en
   una conexión lenta el celular se queda "en blanco" un rato y parece
   trabado. Este script muestra una barra fina arriba cuando un clic va a
   disparar una navegación, para que se vea que algo está pasando. */
(function () {
  'use strict';

  var SHOW_DELAY = 200; // ms de margen antes de mostrar la barra (evita el parpadeo en clics que resuelven al instante)
  var bar = null;
  var showTimer = null;

  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'page-loading-bar';
    bar.setAttribute('aria-hidden', 'true');
    (document.body || document.documentElement).appendChild(bar);
    return bar;
  }

  function startBar() {
    showTimer = window.setTimeout(function () {
      var b = ensureBar();
      b.classList.remove('is-done');
      b.style.width = '0';
      // Forzamos reflow para que el navegador anime el ancho desde 0.
      void b.offsetWidth;
      b.classList.add('is-active');
      window.setTimeout(function () { b.style.width = '75%'; }, 20);
    }, SHOW_DELAY);
  }

  function resetBar() {
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    if (bar) { bar.classList.remove('is-active', 'is-done'); bar.style.width = '0'; }
  }

  function isPageNavClick(e) {
    if (e.defaultPrevented || e.button !== 0) return false;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#') return false;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
    if (a.origin !== window.location.origin) return false;
    // Mismo archivo, distinto ancla (ej. volver arriba en la misma página): no es navegación real.
    if (a.pathname === window.location.pathname && a.hash) return false;
    return true;
  }

  document.addEventListener('click', function (e) {
    if (isPageNavClick(e)) startBar();
  }, true);

  // Si la página se restaura desde el historial (bfcache), la barra no debe quedar visible.
  window.addEventListener('pageshow', resetBar);
})();
