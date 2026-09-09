'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Video del logo, versión "badge" contenida (2026-09-09) — el usuario
 * pidió probar el video de HeroAnimado.tsx en el espacio decorativo del
 * hero (que hoy tiene un logo estático, ver app/page.tsx) pero SIN volver
 * al comportamiento viejo de `.hero-anim` (absolute, ocupando el 66%
 * derecho del hero de fondo, que era justo lo que forzaba el h1 a
 * max-width:13ch). Esta versión reusa el mismo `<video>`/misma lógica de
 * autoplay+reintento que HeroAnimado.tsx (copiada, no importada — esa
 * lógica está atada al id="inicio" del hero completo para el parallax del
 * campo de estrellas, que acá no aplica) pero la CONTIENE en una caja
 * circular fija (mismo tratamiento "badge blanco" que el logo del nav),
 * en vez de dejarla flotando suelta — pedido explícito del usuario tras
 * ver que el logo estático "se plantó" sin badge.
 *
 * El contenedor (tamaño/posición) lo define el padre en app/page.tsx,
 * este componente sólo llena el 100%x100% que le den.
 */
export default function HeroLogoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoListo, setVideoListo] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
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
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-full bg-white shadow-md">
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
        className="h-full w-full object-cover"
        style={{ objectPosition: '60% 50%' }}
      />
      {!videoListo && (
        <img
          src="/Logo/Mundo-Magico%20Logo.jpg"
          alt=""
          width={400}
          height={400}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: '60% 50%' }}
        />
      )}
    </div>
  );
}
