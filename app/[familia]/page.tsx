import { notFound } from 'next/navigation';
import { obtenerCatalogoPublico } from '@/lib/catalogo-server';
import { familiasDisponibles, productosDeFamilia, familiaDesdeSlug, slugifyFamilia } from '@/lib/catalogo-familia';
import ProductoCard from '../components/ProductoCard';
import CatalogoPrecios from '../components/CatalogoPrecios';

/**
 * Página de catálogo por familia (reemplaza las 7 páginas de "mundo" —
 * ver docs/superpowers/specs/2026-08-20-nextjs-migracion-familias-design.md,
 * sección 4). Estática (ISR), revalidación exclusivamente on-demand vía
 * revalidateTag('catalogo') desde el Route Handler de Sprint 3 — nunca por
 * tiempo. Cache Components (Next 16) evaluado y NO habilitado para esta
 * tanda (es opt-in, cambia el modelo de caching entero) — se mantiene el
 * modelo clásico de route segment config, que es el que ya asumía el spec.
 */
export const revalidate = false;
export const dynamicParams = false; // sólo las familias que existían al generar — una familia nueva aparece en el próximo build/revalidación de la lista, no por request suelto.

export async function generateStaticParams() {
  const catalogo = await obtenerCatalogoPublico();
  const familias = familiasDisponibles(catalogo.productos);
  return familias.map((familia) => ({ familia: slugifyFamilia(familia) }));
}

export default async function FamiliaPage({ params }: { params: Promise<{ familia: string }> }) {
  const { familia: familiaSlug } = await params;
  const catalogo = await obtenerCatalogoPublico();
  const familia = familiaDesdeSlug(catalogo.productos, familiaSlug);
  if (!familia) notFound();

  const productos = productosDeFamilia(catalogo.productos, familia);

  return (
    <main>
      <section className="catsec">
        <div className="wrap">
          <div className="catsec-head is-visible">
            <h2>{familia}</h2>
          </div>
          <div className="pgrid">
            {productos.map((producto) => (
              <ProductoCard key={producto.id} producto={producto} />
            ))}
          </div>
        </div>
      </section>
      <CatalogoPrecios />
    </main>
  );
}
