'use client';

import { useRef } from 'react';

/**
 * Fila con scroll-snap horizontal + flechas prev/next (2026-09-09) —
 * el usuario preguntó si las vidrieras del home tenían "un navegador"
 * para recorrer los productos, ya que sólo se podían mover arrastrando
 * (mouse/trackpad no siempre es intuitivo para eso, a diferencia de
 * touch en mobile, que ya funciona bien y no se toca acá). Mismo patrón
 * visual que las flechas de HeroCarrusel.tsx (círculo 40px, borde,
 * bg-surface/90) — sólo en desktop (`md:flex`): en mobile el swipe táctil
 * ya es la interacción principal y una flecha superpuesta a la card
 * tapa el ícono de favorito.
 *
 * `Vidriera.tsx` (server component, hace el fetch/filtro de productos)
 * le pasa el `.map()` de `ProductoCard` ya armado como `children` — este
 * componente sólo aporta el contenedor de scroll + los botones, no toca
 * nada de datos.
 */
export default function VidrieraFila({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 226px = 210px de card (ancho fijo, ver Vidriera.tsx) + 16px de gap
  // (--spacing-s2). Un "click" mueve una card completa.
  function mover(direccion: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direccion * 226, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => mover(-1)}
        aria-label="Ver productos anteriores"
        className="absolute left-0 top-1/2 z-10 hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/90 text-fs1 text-ink shadow-sm hover:bg-surface md:flex"
      >
        ‹
      </button>

      <div
        ref={scrollRef}
        className="flex gap-s2 overflow-x-auto pb-s1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {children}
      </div>

      <button
        type="button"
        onClick={() => mover(1)}
        aria-label="Ver más productos"
        className="absolute right-0 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-line bg-surface/90 text-fs1 text-ink shadow-sm hover:bg-surface md:flex"
      >
        ›
      </button>
    </div>
  );
}
