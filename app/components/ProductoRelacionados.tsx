import type { ProductoPublico } from '@/lib/catalogo-familia';
import ProductoCard from './ProductoCard';

/**
 * "También te puede interesar" al pie de la ficha de producto (Sprint 7).
 * No existía ningún concepto de relacionados en el sitio — criterio
 * elegido: mismo mundo + misma familia (si tiene), excluyendo al propio
 * producto, hasta 4. Sin familia, cae a "mismo mundo".
 */
export default function ProductoRelacionados({ producto, catalogo }: { producto: ProductoPublico; catalogo: ProductoPublico[] }) {
  const relacionados = catalogo
    .filter((p) => p.id !== producto.id && p.mundo === producto.mundo && (!producto.familia || p.familia === producto.familia))
    .slice(0, 4);

  if (!relacionados.length) return null;

  return (
    <section className="wrap py-s6" aria-label="También te puede interesar">
      <h2 className="mb-s3 font-display text-fs2 text-ink">También te puede interesar</h2>
      <div className="grid grid-cols-2 gap-s2 md:grid-cols-4 md:gap-s3">
        {relacionados.map((p) => (
          <ProductoCard key={p.id} producto={p} precioOferta={p.precioOferta} />
        ))}
      </div>
    </section>
  );
}
