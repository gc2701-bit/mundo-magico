'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

/**
 * Porteo EXACTO de assets/album.js (sitio viejo) — álbum hojeable con
 * page-flip (StPageFlip), misma versión, mismo CDN, misma configuración.
 * Si la librería no carga o el usuario pidió "reduce motion", deja las
 * páginas apiladas como respaldo legible (mismo criterio que el original
 * — la CSS de .album-book:not(.is-book) ya define esa vista apilada).
 */
declare global {
  interface Window {
    St?: { PageFlip: new (el: HTMLElement, opts: Record<string, unknown>) => PageFlipInstance };
  }
}

interface PageFlipInstance {
  loadFromHTML: (pages: NodeListOf<Element>) => void;
  getCurrentPageIndex: () => number;
  getPageCount: () => number;
  on: (evt: string, cb: () => void) => void;
  flipPrev: () => void;
  flipNext: () => void;
}

export default function AlbumHistoria({ children }: { children: React.ReactNode }) {
  const elRef = useRef<HTMLDivElement>(null);
  const [contador, setContador] = useState('');
  const [prevDisabled, setPrevDisabled] = useState(true);
  const [nextDisabled, setNextDisabled] = useState(false);
  const [esLibro, setEsLibro] = useState(false);
  const bookRef = useRef<PageFlipInstance | null>(null);

  function iniciar() {
    const el = elRef.current;
    if (!el || bookRef.current) return;

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const PF = window.St && window.St.PageFlip;
    const pages = el.querySelectorAll('.page');

    const videoPages: { index: number; video: HTMLVideoElement }[] = [];
    pages.forEach((page, i) => {
      const v = page.querySelector('video');
      if (v) videoPages.push({ index: i, video: v });
    });

    videoPages.forEach((vp) => {
      ['mousedown', 'touchstart', 'pointerdown', 'click'].forEach((evt) => {
        vp.video.addEventListener(evt, (e) => e.stopPropagation());
      });
    });

    function playOnly(activeIndex: number) {
      el!.querySelectorAll('video').forEach((v) => v.pause());
      videoPages.forEach((vp) => {
        if (vp.index === activeIndex) {
          const p = vp.video.play();
          if (p && p.catch) p.catch(() => {});
        }
      });
    }

    function fallback() {
      if (videoPages.length && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const p = (entry.target as HTMLVideoElement).play();
                if (p && p.catch) p.catch(() => {});
              } else {
                (entry.target as HTMLVideoElement).pause();
              }
            });
          },
          { threshold: 0.5 }
        );
        videoPages.forEach((vp) => io.observe(vp.video));
      }
    }

    if (!PF || reduce) {
      fallback();
      return;
    }

    let book: PageFlipInstance;
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
        autoSize: true,
      });
    } catch {
      fallback();
      return;
    }

    bookRef.current = book;
    setEsLibro(true);
    book.loadFromHTML(pages);

    function update() {
      const i = book.getCurrentPageIndex();
      const n = book.getPageCount();
      setContador('Página ' + (i + 1) + ' de ' + n);
      setPrevDisabled(i <= 0);
      setNextDisabled(i >= n - 1);
      playOnly(i);
    }

    book.on('flip', update);
    book.on('init', update);
    update();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') book.flipPrev();
      else if (e.key === 'ArrowRight') book.flipNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }

  useEffect(() => {
    if (window.St && window.St.PageFlip) {
      iniciar();
      return;
    }
    const intervalo = setInterval(() => {
      if (window.St && window.St.PageFlip) {
        clearInterval(intervalo);
        iniciar();
      }
    }, 200);
    // Si la librería no carga en unos segundos (bloqueada, CDN caído),
    // igual queda la vista apilada de respaldo — no hace falta timeout
    // explícito, .album-book:not(.is-book) ya es la CSS por default.
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js" strategy="afterInteractive" />
      <div className="album-stage">
        <div className={'album-book' + (esLibro ? ' is-book' : '')} id="album" ref={elRef}>
          {children}
        </div>
      </div>

      <div className="album-controls" style={{ display: esLibro ? undefined : 'none' }}>
        <button id="albumPrev" type="button" disabled={prevDisabled} onClick={() => bookRef.current?.flipPrev()}>
          ‹ Anterior
        </button>
        <span className="album-counter" aria-live="polite">{contador}</span>
        <button id="albumNext" type="button" disabled={nextDisabled} onClick={() => bookRef.current?.flipNext()}>
          Siguiente ›
        </button>
      </div>
      <p className="reel-hint album-hint">
        {esLibro
          ? 'Arrastrá la esquina de la hoja o usá las flechas para pasar las páginas.'
          : 'Deslizá hacia abajo para ver todas las fotos del álbum.'}
      </p>
    </>
  );
}
