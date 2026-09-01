import Link from 'next/link';
import { urlFoto, type ProductoPublico } from '@/lib/catalogo-familia';
import { FavoritoBoton, AgregarControl } from './carrito/AccionesProducto';

/**
 * Tarjeta de producto — Server Component. Rediseño Sprint 3 (ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md):
 * estilo "playful con badges" acordado con el usuario — esquinas
 * redondeadas, badge fijo en la esquina superior izquierda (oferta/
 * nuevo/sin stock, prioridad en ese orden), precio destacado, placeholder
 * de marca cuando no hay foto curada todavía.
 *
 * El precio se sigue hidratando después, client-side, vía
 * CatalogoPrecios.tsx (mismo mecanismo de siempre — nunca se sirve un
 * precio potencialmente viejo desde ISR) — lo nuevo acá es que también
 * resuelve la oferta (lib/precios-familia.ts:resolverOferta) una vez que
 * conoce el precio real, y reescribe el badge si corresponde. El carrito/
 * favoritos siguen igual, sin tocar (AccionesProducto.tsx).
 *
 * data-precio-oferta: sólo se manda cuando el caller pasa `precioOferta`
 * (hoy: nada todavía — el campo existe en la base desde Sprint 1 pero su
 * curación en el panel admin no es parte de este proyecto; los sprints
 * de páginas que sí lo usen, como el hero del home, lo van a pasar acá).
 *
 * data-id: siempre presente (a diferencia de data-codigo, que falta en
 * los productos sin código de POS — hallazgo de Sprint 5) — es el único
 * identificador estable para tests e2e que verifican paginación sin
 * duplicar/saltear productos.
 *
 * Link (Sprint 7): `/{mundo}/{slug}` — la ficha de producto real. El
 * slug NO es único en todo el catálogo, sólo por mundo (21 productos lo
 * comparten con otro de otro mundo, confirmado contra la base) — nunca
 * armar esta URL sin el segmento de mundo.
 */
type Props = {
  producto: ProductoPublico;
  precioOferta?: number | null;
  nuevo?: boolean;
};

export default function ProductoCard({ producto, precioOferta, nuevo }: Props) {
  const fotos = producto.fotos || [];
  // Sólo variantes activas ("a la venta") cuentan — una sacada de uso
  // desde el panel admin no debe seguir marcando el producto como "de
  // variantes" en la card ni entrar en el precio/stock que se hidrata acá.
  const variantesActivas = (producto.variantes || []).filter((v) => v.activo);
  const esTalles = variantesActivas.length > 0;
  const esGaleria = !esTalles && fotos.length > 1;
  const sinFoto = fotos.length === 0;

  const dataAttrs: Record<string, string> = { 'data-id': producto.id };
  if (esTalles) {
    dataAttrs['data-talles-codigos'] = variantesActivas.map((v) => v.codigo).join(',');
  } else if (producto.codigo) {
    dataAttrs['data-codigo'] = producto.codigo;
  }
  if (precioOferta != null) {
    dataAttrs['data-precio-oferta'] = String(precioOferta);
  }

  return (
    <Link
      href={`/${producto.mundo}/${producto.slug}`}
      className={'group pcard' + (esGaleria ? ' has-gallery' : '') + ' flex h-full flex-col overflow-hidden rounded-brand border border-line bg-surface shadow-sm transition-shadow hover:shadow-md'}
      {...dataAttrs}
    >
      <div className="pcard-ph relative aspect-square bg-surface">
        {sinFoto ? (
          <div className="flex h-full w-full items-center justify-center bg-background">
            <img
              src="/Logo/Mundo-Magico%20Logo.jpg"
              alt=""
              aria-hidden="true"
              width={64}
              height={64}
              className="h-16 w-16 rounded-full opacity-60"
            />
          </div>
        ) : esGaleria ? (
          <div className="gtrack">
            {fotos.map((f, i) => (
              <img
                key={i}
                src={urlFoto(f.src)}
                alt={producto.titulo + (f.cap ? ' · ' + f.cap : '')}
                width={600}
                height={600}
                loading="lazy"
                className="group-data-[agotado]:opacity-60 group-data-[agotado]:grayscale"
              />
            ))}
          </div>
        ) : (
          <img
            src={urlFoto(fotos[0].src)}
            alt={producto.titulo}
            width={600}
            height={600}
            loading="lazy"
            className="h-full w-full object-contain group-data-[agotado]:opacity-60 group-data-[agotado]:grayscale"
          />
        )}

        {/* Badge — prioridad sin stock > oferta > nuevo, ver CatalogoPrecios.tsx */}
        <span
          data-badge
          className="pcard-badge absolute left-2.5 top-2.5 z-[2] hidden rounded-full px-2.5 py-1 font-body text-fs-1 font-semibold text-white!"
          data-badge-tipo={nuevo ? 'nuevo' : undefined}
          style={nuevo ? { display: 'inline-block', background: 'var(--color-blue)' } : undefined}
        >
          {nuevo ? 'Nuevo' : ''}
        </span>

        <FavoritoBoton producto={producto} />
      </div>
      {/* Sin la clase "pcard-body" a propósito: v2.css le agrega un
          ::after de "quedan pocas unidades" a esa clase que siempre cae
          DESPUÉS del botón (los pseudo-elementos no se pueden reordenar)
          — acá ese mensaje ya es un elemento real más arriba, mantener
          la clase mostraría los dos a la vez. */}
      <div className="flex flex-1 flex-col gap-1 p-s2">
        {producto.familia && (
          <span className="font-body text-fs-1 uppercase tracking-wide text-muted">{producto.familia}</span>
        )}
        {/* v2.css tiene `.pcard h3{font-weight:800; font-size:15px; ...}`
            sin capa — se pisa con `!` (mismo motivo que en todos lados,
            ver el comentario grande de arriba) para el peso/tamaño que
            pide el diseño nuevo. */}
        <h3 className="font-body! text-fs0! font-semibold! text-ink!">{producto.titulo}</h3>
        {/* .pricetag: v2.css lo pinta como pastilla amarilla flotando sobre
            la foto (diseño viejo) — se pisa a mano con `!` (mismo motivo
            que Nav/Footer, ver ese comentario) para el precio en negrita
            simple que pide el diseño nuevo. El contenido lo escribe
            CatalogoPrecios.tsx (textContent/DOM, nunca innerHTML). */}
        <span className="pricetag block! static! m-0! rounded-none! bg-transparent! p-0! font-body! text-fs1! font-extrabold! text-ink! shadow-none! [&_.pricetag-antes]:mr-1.5 [&_.pricetag-antes]:font-normal [&_.pricetag-antes]:text-muted [&_.pricetag-antes]:line-through" />
        {producto.specs && producto.specs.length > 0 && (
          <ul className="specs m-0 list-none p-0">
            {producto.specs.slice(0, 2).map((s, i) => (
              <li key={i} className="font-body text-fs-1 text-muted">{s}</li>
            ))}
          </ul>
        )}

        {/* Empuja lo de abajo al piso de la card, sin importar cuánto
            contenido haya arriba (familia/specs varían) — pedido
            explícito del usuario: el botón siempre en la misma posición
            de pantalla entre cards. */}
        <div className="mt-auto flex flex-col gap-1">
          {/* "Quedan pocas unidades": antes era un ::after de v2.css que
              siempre caía DESPUÉS del botón (los pseudo-elementos no se
              pueden reordenar por CSS) — pedido explícito del usuario:
              arriba del botón. Se resuelve con un elemento real,
              hidratado por CatalogoPrecios.tsx igual que el precio. */}
          <span
            data-pocas-unidades-msg
            className="hidden font-body text-fs-1 font-medium text-orange-ink"
          >
            Quedan pocas unidades
          </span>
          <AgregarControl producto={producto} />
        </div>
      </div>
    </Link>
  );
}
