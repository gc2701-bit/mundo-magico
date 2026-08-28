import { notFound } from 'next/navigation';
import { obtenerCatalogoPublico } from '@/lib/catalogo-server';
import Breadcrumbs from '../../components/Breadcrumbs';
import ProductoFicha from '../../components/ProductoFicha';
import ProductoRelacionados from '../../components/ProductoRelacionados';
import ProductoCTASticky from '../../components/ProductoCTASticky';
import CatalogoPrecios from '../../components/CatalogoPrecios';

/**
 * Ficha de producto — Sprint 7 (ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md).
 * Página nueva de punta a punta: no existía ningún detalle de producto
 * en el sitio, ni modal ni URL propia (confirmado revisando `master` —
 * lo único parecido, `assets/producto.js`, es un normalizador de datos
 * para el carrito, no una vista).
 *
 * Ruta `/[mundo]/[slug]`, nunca `/[slug]` a secas: el slug sólo es único
 * *por mundo* (`catalogo_productos_slug_por_pagina` en
 * supabase/catalogo_03_subcategorias.sql) — 21 productos reales
 * comparten slug con otro de un mundo distinto.
 *
 * Precio/stock/oferta: mismo mecanismo que ProductoCard.tsx
 * (data-codigo o data-talles-codigos + .pricetag, hidratado por
 * CatalogoPrecios.tsx) — nunca se sirve un precio potencialmente viejo
 * desde ISR.
 *
 * El grid de dos columnas (galería + selector) vive en ProductoFicha.tsx
 * (Sprint 5 del plan de catálogo admin) — necesita ser Client Component
 * para que la galería y el selector de variantes talle×tipo compartan
 * estado (imagen de la variante elegida), algo que este Server Component
 * no puede sostener. El resto de la página (breadcrumbs, relacionados,
 * CTA sticky, hidratación de precios) se queda acá sin cambios.
 *
 * `dynamicParams` (sin export, default `true` desde el incidente de
 * producción 2026-08-28, Sprint 2 de tasks/plan.md) — mismo motivo que
 * `app/[mundo]/page.tsx`: si la caché ISR de un producto conocido queda
 * en mal estado, el próximo visitante dispara un render on-the-fly en
 * vez de quedar atado a un 404 permanente hasta un redeploy.
 */
export const revalidate = false;

export async function generateStaticParams() {
  const catalogo = await obtenerCatalogoPublico();
  return catalogo.productos.map((p) => ({ mundo: p.mundo, slug: p.slug }));
}

export default async function ProductoPage({ params }: { params: Promise<{ mundo: string; slug: string }> }) {
  const { mundo: mundoSlug, slug } = await params;
  const catalogo = await obtenerCatalogoPublico();

  const mundo = catalogo.mundos.find((m) => m.slug === mundoSlug);
  const producto = catalogo.productos.find((p) => p.mundo === mundoSlug && p.slug === slug);
  if (!mundo || !producto) notFound();

  const crumbs = [
    { label: 'Inicio', href: '/' },
    { label: mundo.nombre, href: `/${mundo.slug}` },
    ...(producto.familia ? [{ label: producto.familia }] : []),
    { label: producto.titulo },
  ];

  return (
    <main>
      <div className="wrap pt-s3">
        <Breadcrumbs items={crumbs} />
      </div>

      <ProductoFicha producto={producto} />

      <ProductoRelacionados producto={producto} catalogo={catalogo.productos} />

      <ProductoCTASticky producto={producto} />

      <CatalogoPrecios />
    </main>
  );
}
