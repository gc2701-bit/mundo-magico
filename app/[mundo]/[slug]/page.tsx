import { notFound } from 'next/navigation';
import { obtenerCatalogoPublico } from '@/lib/catalogo-server';
import Breadcrumbs from '../../components/Breadcrumbs';
import ProductoGaleria from '../../components/ProductoGaleria';
import ProductoRelacionados from '../../components/ProductoRelacionados';
import ProductoCTASticky from '../../components/ProductoCTASticky';
import CatalogoPrecios from '../../components/CatalogoPrecios';
import { FavoritoBoton, AgregarControl } from '../../components/carrito/AccionesProducto';

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
 */
export const revalidate = false;
export const dynamicParams = false;

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

  const esTalles = !!(producto.talles && producto.talles.length > 1);
  const dataAttrs: Record<string, string> = {};
  if (esTalles && producto.talles) {
    dataAttrs['data-talles-codigos'] = producto.talles.map((t) => t.codigo).join(',');
  } else if (producto.codigo) {
    dataAttrs['data-codigo'] = producto.codigo;
  }
  if (producto.precioOferta != null) {
    dataAttrs['data-precio-oferta'] = String(producto.precioOferta);
  }

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

      <div className="wrap grid grid-cols-1 gap-s5 py-s5 md:grid-cols-2 md:gap-s8">
        <ProductoGaleria fotos={producto.fotos} titulo={producto.titulo} />

        <div {...dataAttrs} className="flex flex-col gap-s3">
          <span
            data-badge
            className="hidden w-fit rounded-full px-2.5 py-1 font-body text-fs-1 font-semibold text-white!"
          />
          <div className="flex items-start justify-between gap-s3">
            <h1 className="font-display text-fs3 text-ink">{producto.titulo}</h1>
            <FavoritoBoton producto={producto} variante="pagina" />
          </div>
          {producto.familia && (
            <span className="w-fit font-body text-fs-1 uppercase tracking-wide text-muted">{producto.familia}</span>
          )}
          <span className="pricetag block! static! m-0! rounded-none! bg-transparent! p-0! font-body! text-fs2! font-extrabold! text-ink! shadow-none! [&_.pricetag-antes]:mr-1.5 [&_.pricetag-antes]:font-normal [&_.pricetag-antes]:text-muted [&_.pricetag-antes]:line-through" />
          <span data-pocas-unidades-msg className="hidden font-body text-fs-1 font-medium text-orange-ink" />

          {producto.descripcion && (
            <p className="font-display text-fs0 italic text-ink">{producto.descripcion}</p>
          )}

          {producto.specs && producto.specs.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {producto.specs.map((s, i) => (
                <li key={i} className="font-display text-fs0 italic text-muted">{s}</li>
              ))}
            </ul>
          )}

          <div id="elegir-talle" className="mt-s2">
            <AgregarControl producto={producto} variante="pagina" />
          </div>
        </div>
      </div>

      <ProductoRelacionados producto={producto} catalogo={catalogo.productos} />

      <ProductoCTASticky producto={producto} />

      <CatalogoPrecios />
    </main>
  );
}
