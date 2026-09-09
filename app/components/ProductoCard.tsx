import Link from 'next/link';
import { urlFoto, type ProductoPublico } from '@/lib/catalogo-familia';
import { resolverEstadoProducto, resolverOferta } from '@/lib/precios-familia';
import type { PreciosPublico } from '@/lib/catalogo-precios-publico';
import { FavoritoBoton, AgregarControl } from './carrito/AccionesProducto';

/**
 * Tarjeta de producto — Server Component. Rediseño Sprint 3 (ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md):
 * estilo "playful con badges" acordado con el usuario — esquinas
 * redondeadas, badge fijo en la esquina superior izquierda (oferta/
 * nuevo/sin stock, prioridad en ese orden), precio destacado, placeholder
 * de marca cuando no hay foto curada todavía.
 *
 * Dos formas de resolver precio/stock, según quién renderiza la tarjeta:
 *
 * 1. **Sin `precios` (Vidriera.tsx, ProductoRelacionados.tsx)** — páginas
 *    que se montan una sola vez y no vuelven a re-renderizar su grilla:
 *    la tarjeta se sirve con `data-codigo`/`data-talles-codigos` vacía y
 *    CatalogoPrecios.tsx la hidrata después, client-side (mismo mecanismo
 *    de siempre — nunca se sirve un precio potencialmente viejo desde
 *    ISR).
 * 2. **Con `precios` (MundoContenido.tsx, usado en explorar/[mundo])** —
 *    grillas que SÍ vuelven a renderizar sus tarjetas después del mount
 *    (buscar, filtrar, "Cargar más"): acá no sirve el mecanismo de
 *    arriba, porque CatalogoPrecios.tsx sólo escanea el DOM una vez al
 *    montar la página entera y nunca se entera de tarjetas nuevas (bug
 *    real reportado por el usuario, 2026-09-07 — "no muestra precio al
 *    buscar en catálogo completo, sólo al entrar a la ficha"). Con
 *    `precios` ya resuelto (mismo `catalogo_publico()`, compartido vía
 *    lib/catalogo-precios-publico.ts), el precio/oferta/badge/stock se
 *    calculan acá mismo con React en cada render — sin DOM, sin efectos,
 *    así que sobrevive cualquier cambio de la lista de tarjetas. Las
 *    páginas que usan este modo (`app/explorar/page.tsx`,
 *    `app/[mundo]/page.tsx`) ya NO montan `<CatalogoPrecios />` — por eso
 *    los `data-codigo`/`data-talles-codigos` de abajo, aunque se sigan
 *    mandando siempre (los use o no cada modo), son inertes acá: nada los
 *    lee salvo tests/herramientas externas.
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
  /** Ver el comentario grande de arriba — modo 2 (resuelto por React) cuando se pasa. */
  precios?: PreciosPublico;
  /** Clase Tailwind de fondo (ej. "bg-red-600") para el botón "Agregar" —
   * Task A3, sólo la pasa Vidriera.tsx (home). Ver el comentario grande
   * de AgregarControl en carrito/AccionesProducto.tsx para el mecanismo. */
  accent?: string;
};

export default function ProductoCard({ producto, precioOferta, nuevo, precios, accent }: Props) {
  const fotos = producto.fotos || [];
  // Sólo variantes activas ("a la venta") cuentan — una sacada de uso
  // desde el panel admin no debe seguir marcando el producto como "de
  // variantes" en la card ni entrar en el precio/stock que se hidrata acá.
  const variantesActivas = (producto.variantes || []).filter((v) => v.activo);
  const esTalles = variantesActivas.length > 0;
  const esGaleria = !esTalles && fotos.length > 1;
  const sinFoto = fotos.length === 0;

  const estadoReact = precios
    ? resolverEstadoProducto(producto, precios.precios, precios.sinStock, precios.pocasUnidades)
    : null;
  const precioRealReact = precios && !esTalles && producto.codigo ? precios.precios[producto.codigo] ?? null : null;
  const ofertaReact = precios ? resolverOferta(precioRealReact, precioOferta) : null;

  // data-codigo/data-talles-codigos/data-precio-oferta se mandan siempre
  // (los use o no CatalogoPrecios.tsx) — identifican la tarjeta para tests
  // e2e y otras herramientas. En modo 2 son inertes de verdad: la página
  // que pasa `precios` (MundoContenido.tsx → explorar/[mundo]) no monta
  // CatalogoPrecios.tsx, así que nada más los lee.
  const dataAttrs: Record<string, string> = { 'data-id': producto.id };
  if (esTalles) {
    dataAttrs['data-talles-codigos'] = variantesActivas.map((v) => v.codigo).join(',');
  } else if (producto.codigo) {
    dataAttrs['data-codigo'] = producto.codigo;
  }
  if (precioOferta != null) {
    dataAttrs['data-precio-oferta'] = String(precioOferta);
  }
  if (estadoReact?.sinStock) dataAttrs['data-agotado'] = '1';

  // Mismo orden de prioridad que antes tenía CatalogoPrecios.tsx: sin
  // stock > oferta > nuevo. En modo 1 (sin `precios`) estadoReact/
  // ofertaReact son null, así que esto cae directo al default de
  // siempre (sólo "Nuevo" si corresponde) y CatalogoPrecios.tsx sigue
  // siendo quien decide el resto después, por DOM.
  const badgeTexto = estadoReact?.sinStock
    ? 'Sin stock'
    : ofertaReact?.enOferta
      ? `-${ofertaReact.porcentajeOff}%`
      : nuevo
        ? 'Nuevo'
        : '';
  const badgeFondo = estadoReact?.sinStock
    ? 'var(--color-muted)'
    : ofertaReact?.enOferta
      ? 'var(--color-red-ink)'
      : 'var(--color-blue)';

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

        {/* Badge — prioridad sin stock > oferta > nuevo, ver el comentario
            grande de ProductoCard sobre los dos modos de resolución. */}
        <span
          data-badge
          className="pcard-badge absolute left-2.5 top-2.5 z-[2] hidden rounded-full px-2.5 py-1 font-body text-fs-1 font-semibold text-white!"
          data-badge-tipo={nuevo ? 'nuevo' : undefined}
          style={badgeTexto ? { display: 'inline-block', background: badgeFondo } : undefined}
        >
          {badgeTexto}
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
            simple que pide el diseño nuevo. En modo 1 el contenido lo
            escribe CatalogoPrecios.tsx (textContent/DOM); en modo 2
            (`precios` presente) se renderiza acá mismo, por React. */}
        <span className="pricetag block! static! m-0! rounded-none! bg-transparent! p-0! font-body! text-fs1! font-extrabold! text-ink! shadow-none! [&_.pricetag-antes]:mr-1.5 [&_.pricetag-antes]:font-normal [&_.pricetag-antes]:text-muted [&_.pricetag-antes]:line-through">
          {ofertaReact?.enOferta ? (
            <>
              <span className="pricetag-antes">{ofertaReact.precioAntes}</span>
              <span className="pricetag-ahora">{ofertaReact.precioAhora}</span>
            </>
          ) : (
            estadoReact?.texto ?? null
          )}
        </span>
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
              arriba del botón. Se resuelve con un elemento real: en modo 1
              lo hidrata CatalogoPrecios.tsx (por eso arranca "hidden" acá
              y esa clase se pisa por estilo inline), en modo 2 se decide
              acá mismo por React. */}
          <span
            data-pocas-unidades-msg
            className={'font-body text-fs-1 font-medium text-orange-ink ' + (estadoReact?.pocasUnidades ? 'block' : 'hidden')}
          >
            Quedan pocas unidades
          </span>
          <AgregarControl producto={producto} accent={accent} />
        </div>
      </div>
    </Link>
  );
}
