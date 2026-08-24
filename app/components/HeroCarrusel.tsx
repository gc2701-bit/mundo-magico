'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ProductoPublico } from '@/lib/catalogo-familia';

/**
 * Carrusel de ofertas/destacados del home (Sprint 4, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md) —
 * un producto a la vez, a pantalla completa, navegación por puntos +
 * flechas (sumadas a pedido del usuario, 2026-08-24 — el contenido queda
 * centrado en desktop, antes arrancaba pegado a la izquierda). Contenido
 * curado por el admin vía `destacado_home`/`precio_oferta`
 * (catalogo_productos) — el UI de esa curación no es parte de este
 * proyecto, así que hoy no hay ninguno marcado. `productos` ya viene con
 * el fallback resuelto desde app/page.tsx (primeros publicados) para que
 * el carrusel nunca esté vacío mientras no exista curación real.
 *
 * Reusa el mismo mecanismo de precio que ProductoCard.tsx: data-codigo +
 * .pricetag, hidratado por CatalogoPrecios.tsx (ya montado en esta
 * página) — sin duplicar lógica de precio/oferta.
 */
export default function HeroCarrusel({ productos }: { productos: ProductoPublico[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (productos.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % productos.length), 6000);
    return () => clearInterval(t);
  }, [productos.length]);

  if (!productos.length) return null;
  const p = productos[Math.min(i, productos.length - 1)];
  const foto = p.fotos?.[0];
  const dataAttrs: Record<string, string> = {};
  if (p.codigo) dataAttrs['data-codigo'] = p.codigo;
  if (p.precioOferta != null) dataAttrs['data-precio-oferta'] = String(p.precioOferta);

  const anterior = () => setI((v) => (v - 1 + productos.length) % productos.length);
  const siguiente = () => setI((v) => (v + 1) % productos.length);

  return (
    <section aria-label="Ofertas y destacados" className="relative border-b border-line bg-surface">
      {productos.length > 1 && (
        <>
          <button
            type="button"
            onClick={anterior}
            aria-label="Destacado anterior"
            className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/90 text-fs1 text-ink shadow-sm hover:bg-surface md:left-4"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={siguiente}
            aria-label="Destacado siguiente"
            className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/90 text-fs1 text-ink shadow-sm hover:bg-surface md:right-4"
          >
            ›
          </button>
        </>
      )}

      <Link
        href={p.mundo ? '/' + p.mundo : '/explorar'}
        className="mx-auto flex max-w-3xl flex-col items-center gap-s3 px-s8 py-s6 text-center md:flex-row md:justify-center md:gap-s6 md:px-s10 md:text-left"
        {...dataAttrs}
      >
        {foto ? (
          <img
            src={'/' + foto.src}
            alt={p.titulo}
            width={480}
            height={480}
            className="h-48 w-48 shrink-0 rounded-brand object-contain md:h-64 md:w-64"
          />
        ) : (
          <img
            src="/Logo/Mundo-Magico%20Logo.jpg"
            alt=""
            aria-hidden="true"
            width={480}
            height={480}
            className="h-48 w-48 shrink-0 rounded-brand object-contain opacity-60 md:h-64 md:w-64"
          />
        )}
        <div>
          <span className="font-body text-fs-1 font-semibold uppercase tracking-wide text-green-ink!">
            Destacado
          </span>
          <h2 className="font-display text-fs3 text-ink">{p.titulo}</h2>
          <span className="pricetag mt-s1 block! static! rounded-none! bg-transparent! p-0! font-body! text-fs2! font-extrabold! text-ink! shadow-none! [&_.pricetag-antes]:mr-1.5 [&_.pricetag-antes]:font-normal [&_.pricetag-antes]:text-muted [&_.pricetag-antes]:line-through" />
          <span className="mt-s2 inline-block rounded-brand bg-green px-s4 py-s2 font-body text-fs0 font-semibold text-white!">
            Ver más →
          </span>
        </div>
      </Link>
      {productos.length > 1 && (
        <div className="flex justify-center pb-s3" role="tablist" aria-label="Seleccionar destacado">
          {/* botón de 24x24 (mínimo táctil, Lighthouse target-size) con el
              punto visual de 8x8 centrado adentro — el punto solo no
              alcanzaba como área de toque en mobile. */}
          {productos.map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={idx === i}
              aria-label={`Ver destacado ${idx + 1} de ${productos.length}`}
              onClick={() => setI(idx)}
              className="flex h-6 w-6 items-center justify-center"
            >
              <span className={'block h-2 w-2 rounded-full ' + (idx === i ? 'bg-green' : 'bg-line')} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
