import { notFound } from 'next/navigation';
import { obtenerCatalogoPublico } from '@/lib/catalogo-server';
import { mundosDisponibles, productosDeMundo } from '@/lib/catalogo-mundo';
import ProductoCard from '../components/ProductoCard';
import CatalogoPrecios from '../components/CatalogoPrecios';

/**
 * Página de catálogo por mundo (reemplaza a app/[familia]/page.tsx desde
 * Sprint 5.5 — ver docs/superpowers/plans/2026-08-20-nextjs-migracion-familias-plan.md,
 * sección Sprint 5.5). Estática (ISR), revalidación exclusivamente
 * on-demand vía revalidateTag('catalogo') — nunca por tiempo. A diferencia
 * de familia, `mundo` ya ES el slug de la URL (columna
 * catalogo_productos.mundo) — no hace falta slugify/reverse-lookup.
 */
export const revalidate = false;
export const dynamicParams = false; // sólo los mundos que existían al generar — uno nuevo aparece en el próximo build/revalidación de la lista, no por request suelto.

export async function generateStaticParams() {
  const catalogo = await obtenerCatalogoPublico();
  const mundos = mundosDisponibles(catalogo.productos);
  return mundos.map((mundo) => ({ mundo }));
}

export default async function MundoPage({ params }: { params: Promise<{ mundo: string }> }) {
  const { mundo: mundoSlug } = await params;
  const catalogo = await obtenerCatalogoPublico();

  const productos = productosDeMundo(catalogo.productos, mundoSlug);
  if (!productos.length) notFound();

  const mundo = catalogo.mundos.find((m) => m.slug === mundoSlug);
  const nombre = mundo?.nombre || mundoSlug;

  return (
    <main>
      <section className="catsec">
        <div className="wrap">
          <div className="catsec-head is-visible">
            <h2>{nombre}</h2>
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
