import type { ProductoPublico } from '@/lib/catalogo-familia';

/**
 * Tarjeta de producto — Server Component. Sin interactividad propia
 * (carrito llega en Sprint 5); el precio se hidrata después, client-side,
 * vía CatalogoPrecios.tsx (Task 2.3) usando los data-attributes de acá.
 *
 * Reusa exactamente las clases de public/assets/v2.css (.pcard, .pgrid,
 * .pcard-ph, .pcard-body, .specs, .pricetag) — mismo diseño visual que el
 * sitio viejo, no se rediseña de cero para esta migración.
 */
export default function ProductoCard({ producto }: { producto: ProductoPublico }) {
  const fotos = producto.fotos || [];
  const esTalles = !!(producto.talles && producto.talles.length);
  const esGaleria = !esTalles && fotos.length > 1;

  const dataAttrs: Record<string, string> = {};
  if (esTalles && producto.talles) {
    dataAttrs['data-talles-codigos'] = producto.talles.map((t) => t.codigo).join(',');
  } else if (producto.codigo) {
    dataAttrs['data-codigo'] = producto.codigo;
  }

  return (
    <a href="#" className={'pcard' + (esGaleria ? ' has-gallery' : '')} {...dataAttrs}>
      <div className="pcard-ph">
        {esGaleria ? (
          <div className="gtrack">
            {fotos.map((f, i) => (
              <img
                key={i}
                src={'/' + f.src}
                alt={producto.titulo + (f.cap ? ' · ' + f.cap : '')}
                width={600}
                height={600}
                loading="lazy"
              />
            ))}
          </div>
        ) : (
          <img
            src={'/' + (fotos[0]?.src || '')}
            alt={producto.titulo}
            width={600}
            height={600}
            loading="lazy"
          />
        )}
        <span className="pricetag" />
      </div>
      <div className="pcard-body">
        <h3>{producto.titulo}</h3>
        {producto.specs && producto.specs.length > 0 && (
          <ul className="specs">
            {producto.specs.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        )}
      </div>
    </a>
  );
}
