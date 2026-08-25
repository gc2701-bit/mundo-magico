'use client';

import { useState } from 'react';
import type { ProductoPublico } from '@/lib/catalogo-familia';
import ProductoGaleria from './ProductoGaleria';
import ComboComposicion from './ComboComposicion';
import { FavoritoBoton, AgregarControl } from './carrito/AccionesProducto';

/**
 * Puente cliente entre ProductoGaleria y AgregarControl en la ficha de
 * producto (Sprint 5 del plan de catálogo admin,
 * SPEC-catalogo-admin-variantes.md sección 6) — son hermanos en el grid
 * de dos columnas, no padre/hijo, así que necesitan un ancestro cliente
 * común para compartir "qué variante está elegida ahora mismo" (la
 * imagen de esa variante reemplaza la galería general mientras dure la
 * elección). page.tsx (Server Component) no puede sostener ese estado.
 *
 * El resto del contenido de la ficha (breadcrumbs, specs, descripción)
 * se queda en page.tsx sin cambios — sólo se movió acá lo que
 * genuinamente necesita compartir estado. `'use client'` no le cuesta
 * SEO/SSR: la página entera sigue siendo estática
 * (generateStaticParams + revalidate:false), esto también se renderiza
 * en el HTML servido, sólo se hidrata con interactividad además.
 */
export default function ProductoFicha({ producto }: { producto: ProductoPublico }) {
  const [imagenSeleccionada, setImagenSeleccionada] = useState<string | null>(null);

  const esTalles = !!(producto.variantes && producto.variantes.filter((v) => v.activo).length > 1);
  const dataAttrs: Record<string, string> = {};
  if (esTalles && producto.variantes) {
    dataAttrs['data-talles-codigos'] = producto.variantes.filter((v) => v.activo).map((v) => v.codigo).join(',');
  } else if (producto.codigo) {
    dataAttrs['data-codigo'] = producto.codigo;
  }
  if (producto.precioOferta != null) {
    dataAttrs['data-precio-oferta'] = String(producto.precioOferta);
  }

  return (
    <div className="wrap grid grid-cols-1 gap-s5 py-s5 md:grid-cols-2 md:gap-s8">
      <ProductoGaleria fotos={producto.fotos} titulo={producto.titulo} fotoDestacada={imagenSeleccionada} />

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

        <ComboComposicion codigo={producto.codigo || producto.variantes?.[0]?.codigo || null} />

        <div id="elegir-talle" className="mt-s2">
          <AgregarControl producto={producto} variante="pagina" onCambiarImagen={setImagenSeleccionada} />
        </div>
      </div>
    </div>
  );
}
