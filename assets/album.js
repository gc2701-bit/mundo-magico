/* Álbum hojeable de la historia · usa page-flip (StPageFlip).
   Si la librería no carga o el usuario pidió "reduce motion",
   deja las páginas apiladas como respaldo legible. */
(function () {
  var el = document.getElementById('album');
  if (!el) return;

  var prevBtn = document.getElementById('albumPrev');
  var nextBtn = document.getElementById('albumNext');
  var counter = document.getElementById('albumCounter');
  var controls = document.querySelector('.album-controls');
  var hint = document.querySelector('.album-hint');

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PF = window.St && window.St.PageFlip;

  var pages = el.querySelectorAll('.page');

  // Índice de cada página que contiene un video, para reproducirlo solo cuando está a la vista.
  var videoPages = [];
  pages.forEach(function (page, i) {
    var v = page.querySelector('video');
    if (v) videoPages.push({ index: i, video: v });
  });

  // Evitar que el page-flip capture los gestos hechos sobre los controles del
  // video: sin esto, tocar play/pausa cerca de la esquina voltea la hoja.
  videoPages.forEach(function (vp) {
    ['mousedown', 'touchstart', 'pointerdown', 'click'].forEach(function (evt) {
      vp.video.addEventListener(evt, function (e) { e.stopPropagation(); });
    });
  });

  function playOnly(activeIndex) {
    // Pausar cualquier <video> presente, incluidos los clones temporales que
    // el page-flip crea mientras se voltea la hoja.
    el.querySelectorAll('video').forEach(function (v) { v.pause(); });
    videoPages.forEach(function (vp) {
      if (vp.index === activeIndex) {
        var p = vp.video.play();
        if (p && p.catch) p.catch(function () {});
      }
    });
  }

  function fallback() {
    if (controls) controls.style.display = 'none';
    if (hint) hint.textContent = 'Deslizá hacia abajo para ver todas las fotos del álbum.';
    // Sin page-flip las hojas quedan apiladas: reproducimos el video al entrar en pantalla.
    if (videoPages.length && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var p = entry.target.play();
            if (p && p.catch) p.catch(function () {});
          } else {
            entry.target.pause();
          }
        });
      }, { threshold: 0.5 });
      videoPages.forEach(function (vp) { io.observe(vp.video); });
    }
  }

  if (!PF || reduce) { fallback(); return; }

  var book;
  try {
    book = new PF(el, {
      width: 400,
      height: 560,
      size: 'stretch',
      minWidth: 300,
      maxWidth: 480,
      minHeight: 420,
      maxHeight: 620,
      maxShadowOpacity: 0.4,
      showCover: true,
      usePortrait: true,
      mobileScrollSupport: true,
      drawShadow: true,
      flippingTime: 800,
      autoSize: true
    });
  } catch (e) {
    fallback();
    return;
  }

  el.classList.add('is-book');
  book.loadFromHTML(pages);

  function update() {
    var i = book.getCurrentPageIndex();
    var n = book.getPageCount();
    if (counter) counter.textContent = 'Página ' + (i + 1) + ' de ' + n;
    if (prevBtn) prevBtn.disabled = i <= 0;
    if (nextBtn) nextBtn.disabled = i >= n - 1;
    playOnly(i);
  }

  book.on('flip', update);
  book.on('init', update);
  update();

  if (prevBtn) prevBtn.addEventListener('click', function () { book.flipPrev(); });
  if (nextBtn) nextBtn.addEventListener('click', function () { book.flipNext(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { book.flipPrev(); }
    else if (e.key === 'ArrowRight') { book.flipNext(); }
  });
})();
