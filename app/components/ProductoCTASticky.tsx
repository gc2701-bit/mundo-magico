'use client';

import { useCarrito } from './carrito/CarritoProvider';
import type { ProductoPublico } from '@/lib/catalogo-familia';

/**
 * CTA sticky mobile de la ficha de producto (Sprint 7) — barra fija
 * arriba de la barra de navegación inferior con precio + "Agregar al
 * carrito", para no tener que scrollear hasta arriba en productos con
 * ficha técnica larga. Con talles, no puede "agregar" a ciegas (no sabe
 * cuál) — en cambio lleva al selector real (`#elegir-talle` en
 * app/[mundo]/[slug]/page.tsx).
 */
export default function ProductoCTASticky({ producto }: { producto: ProductoPublico }) {
  const { agregar, abrirPanel } = useCarrito();
  // Sólo variantes activas ("a la venta") — una sacada de uso no debe
  // seguir empujando al visitante al selector ni resolver precio.
  const variantesActivas = (producto.variantes || []).filter((v) => v.activo);
  const tieneTalles = variantesActivas.length > 1;
  const foto = '/' + (producto.fotos[0]?.src || '');
  const simple = { title: producto.titulo, code: producto.codigo || variantesActivas[0]?.codigo || '', variant: variantesActivas[0]?.talle || '' };

  const dataAttrs: Record<string, string> = {};
  if (tieneTalles) {
    dataAttrs['data-talles-codigos'] = variantesActivas.map((v) => v.codigo).join(',');
  } else if (producto.codigo) {
    dataAttrs['data-codigo'] = producto.codigo;
  }

  function onClick() {
    if (tieneTalles) {
      document.getElementById('elegir-talle')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    agregar({ ...simple, img: foto });
    abrirPanel();
  }

  return (
    <div
      {...dataAttrs}
      className="fixed inset-x-0 bottom-16 z-10 flex items-center justify-between gap-s3 border-t border-line bg-surface px-s3 py-s2 md:hidden"
    >
      <span className="pricetag min-w-0 truncate block! static! m-0! rounded-none! bg-transparent! p-0! font-body! text-fs1! font-extrabold! text-ink! shadow-none!" />
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 rounded-brand bg-green px-s4 py-s2 font-body text-fs0 font-semibold text-white!"
      >
        {tieneTalles ? 'Elegir talle' : 'Agregar al carrito'}
      </button>
    </div>
  );
}
