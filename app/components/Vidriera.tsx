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
  alterno = false,
}: {
  titulo: string;
  mundoSlug: string;
  productos: ProductoPublico[];
  icono?: string;
  /** Fondo levemente más oscuro (mismo crema) para separar vidrieras
   * consecutivas — sólo el título las diferenciaba antes. Elegido con el
   * usuario vía companion visual, 2026-08-24 ("Opción A — fondo alternado"). */
  alterno?: boolean;
}) {
  const items = productos.filter((p) => p.mundo === mundoSlug).slice(0, 8);

  return (
    <section className={'py-s6 ' + (alterno ? 'bg-background-alt' : 'bg-background')} aria-labelledby={`vidriera-${mundoSlug}`}>
      <div className="wrap">
        {/* En mobile, título y "Ver todo" en filas separadas — juntos en
            una sola fila quedaban demasiado pegados (feedback del
            usuario, 2026-08-24). En desktop siguen en la misma fila. */}
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-s2">
          <h2 id={`vidriera-${mundoSlug}`} className="font-display text-fs2 text-ink md:text-fs3">
            {titulo}
          </h2>
          <Link href={'/' + mundoSlug} className="self-start font-body text-fs-1 font-semibold text-green-ink! md:self-auto">
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
