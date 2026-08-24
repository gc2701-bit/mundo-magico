'use client';

import { precioUnidad, formatoPlata, type ItemCarrito, type PreciosMapa } from '@/lib/carrito';

/**
 * Fila de un producto del carrito — extraído en Sprint 8 (ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md)
 * porque `CarritoPanel.tsx` (mini-carrito, Sprint 7) y la página
 * `/carrito` nueva necesitan exactamente la misma fila.
 */
export default function CarritoItemRow({
  item,
  precios,
  onCantidad,
  onQuitar,
}: {
  item: ItemCarrito;
  precios: PreciosMapa | null;
  onCantidad: (n: number) => void;
  onQuitar: () => void;
}) {
  const u = precioUnidad(item, precios);

  return (
    <div className="flex gap-s2 border-b border-line pb-s3">
      {item.img && <img src={item.img} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-brand bg-background object-contain" />}
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-fs0 font-semibold text-ink">{item.title}</p>
        {item.variant && <p className="font-body text-fs-1 text-muted">{item.variant}</p>}
        {item.code && <p className="font-body text-fs-1 text-muted">{'Cód. ' + item.code}</p>}
        {u > 0 ? (
          <p className="mt-1 font-body text-fs0 font-semibold text-ink">
            {item.qty > 1 ? `${item.qty} × ${formatoPlata(u)} = ${formatoPlata(u * item.qty)}` : formatoPlata(u)}
          </p>
        ) : precios ? (
          <p className="mt-1 font-body text-fs-1 text-orange-ink">Precio a confirmar</p>
        ) : null}
        <div className="mt-s2 flex items-center gap-s3">
          <div className="flex items-center gap-s2">
            <button type="button" aria-label={'Quitar uno de ' + item.title} disabled={item.qty <= 0} onClick={() => onCantidad(item.qty - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink disabled:opacity-40">−</button>
            <span className="w-5 text-center font-body text-fs0 text-ink">{item.qty}</span>
            <button type="button" aria-label={'Agregar uno de ' + item.title} onClick={() => onCantidad(item.qty + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink">+</button>
          </div>
          <button type="button" onClick={onQuitar} className="font-body text-fs-1 text-muted! underline">Quitar</button>
        </div>
      </div>
    </div>
  );
}
