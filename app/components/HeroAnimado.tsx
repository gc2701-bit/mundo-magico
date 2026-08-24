'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Porteo EXACTO del hero animado de index.html (sitio viejo): video del
 * logo con autoplay diferido + campo de estrellas con parallax por mouse.
 * Se había simplificado a un logo estático al portar el home en caliente
 * (incidente de producción, 2026-08-21) — el usuario pidió reincorporarlo
 * tal cual estaba, no una versión nueva. Mismo markup, mismo JS (adaptado
 * a un useEffect en vez de <script> suelto), mismos 21 puntos del campo
 * de estrellas, mismos colores, misma lógica de reintento de autoplay.
 */

// Campo de estrellas · (x%, y%, tamaño px, índice de color, capa 1-3) —
// mismos valores exactos que index.html.
const STARS: [number, number, number, number, number][] = [
  [6, 16, 22, 0, 3], [13, 62, 14, 1, 2], [4, 42, 11, 2, 1], [17, 28, 9, 4, 2],
  [22, 78, 17, 0, 3], [9, 88, 10, 3, 1], [26, 48, 8, 2, 1],
  [89, 20, 24, 1, 3], [94, 50, 13, 2, 2], [81, 36, 10, 4, 1], [95, 72, 19, 0, 3],
  [77, 68, 11, 3, 2], [86, 88, 14, 1, 1], [73, 44, 8, 0, 1],
  [31, 8, 11, 2, 2], [69, 7, 14, 4, 3], [50, 4, 9, 0, 1], [62, 92, 12, 2, 2], [38, 93, 14, 1, 3],
  [44, 84, 8, 3, 1], [57, 88, 9, 4, 1],
];
const COLORS = ['#1e8834', '#f59a1f', '#2f63cf', '#e23b30', '#ffd23e'];

export default function HeroAnimado() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  // El poster de <video> NO cuenta para LCP (limitación del navegador,
  // sólo el frame real del video cuenta) — con eso solo, el LCP seguía
  // en ~5.7s. Esta imagen es un elemento real superpuesto en el mismo
  // lugar del video, así que SÍ es candidata a LCP: se pinta al toque y
  // desaparece en cuanto el video arranca a reproducirse de verdad.
  // Mismo video, misma animación — sólo cambia qué se ve mientras carga.
  const [videoListo, setVideoListo] = useState(false);

  useEffect(() => {
    // --- Video: se reproduce una sola vez y queda fijo en el último
    // cuadro (sin loop, sin botón de play). El `src` ya viene en el HTML
    // (Sprint 4, rediseño de frontend) — antes se asignaba acá recién
    // después de hidratar, y el navegador no podía ni empezar a
    // descargarlo hasta ese momento (LCP real medido: 6s). Mismo video,
    // misma animación — sólo cambia CUÁNDO arranca la descarga. ---
    const v = videoRef.current;
    if (v) {
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute('muted', '');

      const play = () => {
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      };
      play();

      const kick = () => {
        if (v.paused && !v.ended) play();
        document.removeEventListener('touchstart', kick);
        document.removeEventListener('click', kick);
      };
      document.addEventListener('touchstart', kick, { passive: true, once: true });
      document.addEventListener('click', kick, { once: true });
    }

    // --- Campo de estrellas + parallax por mouse ---
    const field = fieldRef.current;
    if (!field) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let html = '';
    STARS.forEach((s) => {
      html +=
        '<span class="star" data-layer="' + s[4] + '" style="left:' + s[0] + '%;top:' + s[1] + '%">' +
        '<svg width="' + s[2] + '" height="' + s[2] + '" viewBox="0 0 24 24" fill="' + COLORS[s[3]] + '">' +
        '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/></svg></span>';
    });
    field.innerHTML = html;

    const fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    if (reduce || !fine) return;
    const hero = document.getElementById('inicio');
    heroRef.current = hero;
    if (!hero) return;
    const layers = field.querySelectorAll<HTMLElement>('.star');
    let raf: number | null = null;
    let tx = 0;
    let ty = 0;

    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        layers.forEach((el) => {
          const d = +(el.dataset.layer || 0) * 14;
          el.style.translate = -tx * d + 'px ' + -ty * d + 'px';
        });
      });
    };
    const onLeave = () => {
      layers.forEach((el) => {
        el.style.translate = '0px 0px';
      });
    };
    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    return () => {
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="starfield" id="starfield" ref={fieldRef} aria-hidden="true" />
      <div className="hero-anim" aria-hidden="true">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          preload="auto"
          // @ts-expect-error -- fetchPriority es válido en HTML/React 19, los tipos todavía no lo reconocen en <video>
          fetchPriority="high"
          src="/Logo/Logo-Animacion-2.mp4"
          poster="/Logo/Mundo-Magico%20Logo.jpg"
          onPlaying={() => setVideoListo(true)}
        />
        {!videoListo && (
          <img
            src="/Logo/Mundo-Magico%20Logo.jpg"
            alt=""
            width={600}
            height={600}
            fetchPriority="high"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: '60% 50%',
              background: '#fff',
            }}
          />
        )}
      </div>
      <div className="hero-logo-static" aria-hidden="true">
        <img src="/Logo/Mundo-Magico%20Logo.jpg" alt="" width={128} height={128} />
      </div>
    </>
  );
}
