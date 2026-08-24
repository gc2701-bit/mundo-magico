import Link from 'next/link';
import type { ProductoPublico } from '@/lib/catalogo-familia';
import ProductoCard from './ProductoCard';
import EmptyState from './EmptyState';

/**
 * Vidriera de un mundo en el home (Sprint 4, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md) —
 * hasta 8 productos de ese mundo + "Ver todo". Si el mundo todavía no
 * tiene productos publicados (Halloween/Navidad hoy), usa el EmptyState
 * de "mundo sin productos todavía" en vez de una grilla vacía.
 */
export default function Vidriera({
  titulo,
  mundoSlug,
  productos,
  icono = '✨',
}: {
  titulo: string;
  mundoSlug: string;
  productos: ProductoPublico[];
  icono?: string;
}) {
  const items = productos.filter((p) => p.mundo === mundoSlug).slice(0, 8);

  return (
    <section className="py-s6" aria-labelledby={`vidriera-${mundoSlug}`}>
      <div className="wrap">
        <div className="flex items-center justify-between gap-s2">
          <h2 id={`vidriera-${mundoSlug}`} className="font-display text-fs3 text-ink">
            {titulo}
          </h2>
          <Link href={'/' + mundoSlug} className="shrink-0 font-body text-fs-1 font-semibold text-green-ink!">
            Ver todo →
          </Link>
        </div>

        {items.length ? (
          <div className="mt-s3 grid grid-cols-2 gap-s2 md:grid-cols-4 md:gap-s3">
            {items.map((p) => (
              <ProductoCard key={p.id} producto={p} />
            ))}
          </div>
        ) : (
          <div className="mt-s3">
            <EmptyState
              icono={icono}
              titulo={`${titulo} está por venir`}
              descripcion="Todavía no cargamos productos acá"
              accion={{ label: 'Ver otros mundos', href: '/explorar' }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
