'use client';

import { useState } from 'react';
import type { Foto } from '@/lib/catalogo-familia';

/**
 * Galería de fotos de la ficha de producto (Sprint 7, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md) —
 * foto principal grande + tira de miniaturas clickeables. No existía
 * ningún patrón de galería interactivo para reusar: `.gtrack` en
 * ProductoCard.tsx es sólo una tira de fotos sin flechas/miniaturas (no
 * hacía falta más que eso en el tamaño de una card).
 */
export default function ProductoGaleria({ fotos, titulo }: { fotos: Foto[]; titulo: string }) {
  const [activa, setActiva] = useState(0);

  if (!fotos.length) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-brand bg-background">
        <img
          src="/Logo/Mundo-Magico%20Logo.jpg"
          alt=""
          aria-hidden="true"
          width={96}
          height={96}
          className="h-24 w-24 rounded-full opacity-60"
        />
      </div>
    );
  }

  const foto = fotos[activa];

  return (
    <div className="flex flex-col gap-s2">
      <div className="aspect-square overflow-hidden rounded-brand border border-line bg-surface">
        <img
          src={'/' + foto.src}
          alt={titulo + (foto.cap ? ' · ' + foto.cap : '')}
          width={800}
          height={800}
          className="h-full w-full object-contain"
        />
      </div>
      {fotos.length > 1 && (
        <div className="flex gap-s2 overflow-x-auto pb-1" role="tablist" aria-label="Fotos del producto">
          {fotos.map((f, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === activa}
              aria-label={f.cap || `Foto ${i + 1}`}
              onClick={() => setActiva(i)}
              className={
                'h-16 w-16 shrink-0 overflow-hidden rounded-brand border-2 bg-surface ' +
                (i === activa ? 'border-green' : 'border-line')
              }
            >
              <img src={'/' + f.src} alt="" width={64} height={64} className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
