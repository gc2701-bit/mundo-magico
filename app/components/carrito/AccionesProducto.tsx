'use client';

import { useEffect, useState } from 'react';
import { useCarrito } from './CarritoProvider';
import { cargarFavoritos, guardarFavoritos, toggleFavorito, claveFavorito } from '@/lib/favoritos';
import type { ProductoPublico, Variante } from '@/lib/catalogo-familia';
import {
  ejeElegible,
  valoresDeEje,
  valoresAlcanzables,
  seleccionInicial,
  resolverVariante,
  etiquetaVariante,
  type Seleccion,
  type Eje
} from '@/lib/variantes';
import { obtenerPreciosPublicos } from '@/lib/catalogo-precios-publico';

const fmtPrecio = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

/**
 * Botón "Agregar al pedido" + corazón de favoritos de una tarjeta — puerto
 * de montarControl()/montarFavoritos() de carrito.js (Sprint 5, Task 5.2).
 * Dos componentes separados (no uno) porque van en contenedores distintos
 * de la tarjeta (.pcard-ph vs .pcard-body — mismo layout que el sitio
 * viejo, ver ProductoCard.tsx).
 *
 * Simplificación consciente frente al sitio viejo: acá "opciones" es sólo
 * `producto.variantes` (el único caso de variantes que sobrevivió a la
 * migración de datos, ver spec sección 3/4 — una galería de fotos ya NO es
 * una elección de color con código propio, es sólo fotos del mismo
 * producto).
 *
 * `variante` (Sprint 7): mismo componente para la card compacta del
 * catálogo (`'card'`, default — clases legacy `carrito.css`/`v2.css`) y
 * la ficha de producto a página completa (`'pagina'` — Tailwind, selector
 * siempre visible en vez de detrás de un toggle, botón más grande).
 * Reusar en vez de duplicar: la lógica de carrito/favoritos es idéntica,
 * sólo cambia la presentación.
 *
 * Selector talle×tipo (Sprint 5 del plan de catálogo admin,
 * SPEC-catalogo-admin-variantes.md sección 6): en `'card'` sigue siendo
 * una lista plana (una fila por combinación activa, con su propio talle
 * y/o tipo en la etiqueta) — no hay espacio para elegir en dos pasos
 * dentro de una tarjeta chica. En `'pagina'` sí es un selector real con
 * filtrado mutuo entre ejes (`lib/variantes.ts`): elegir un talle acota
 * los tipos/colores disponibles a los que de verdad existen, y viceversa.
 * Una vez resuelta la combinación completa, `onCambiarImagen` (si vino)
 * avisa a ProductoFicha.tsx para que ProductoGaleria muestre la imagen
 * propia de esa variante, y el precio/stock de ESE código puntual se
 * pinta acá mismo (obtenerPreciosPublicos(), no el .pricetag genérico de
 * arriba de la página — evita pisarle el DOM a CatalogoPrecios.tsx).
 *
 * Abrir el mini-carrito al agregar (Sprint 7, pedido explícito del plan):
 * `abrirPanel()` se llama a mano después de cada `agregar`/`setCantidad`
 * que SUMA una unidad — nunca al restar, para no reabrir el panel cuando
 * alguien está sacando cantidad.
 */

export function FavoritoBoton({ producto, variante = 'card' }: { producto: ProductoPublico; variante?: 'card' | 'pagina' }) {
  const [favorito, setFavorito] = useState(false);
  const claveFav = claveFavorito(producto.familia || '', producto.titulo);

  useEffect(() => {
    setFavorito(!!cargarFavoritos()[claveFav]);
  }, [claveFav]);

  function alTocar(ev: React.MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    const favoritos = cargarFavoritos();
    const siguiente = toggleFavorito(favoritos, claveFav, {
      title: producto.titulo,
      img: '/' + (producto.fotos[0]?.src || ''),
      url: producto.mundo ? '/' + producto.mundo : '/explorar',
    });
    guardarFavoritos(siguiente);
    setFavorito(!!siguiente[claveFav]);
  }

  return (
    <button
      type="button"
      className={
        variante === 'pagina'
          ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-background-alt'
          : 'pcard-fav'
      }
      aria-pressed={favorito}
      aria-label={favorito ? 'Sacar de favoritos' : 'Agregar a favoritos'}
      onClick={alTocar}
    >
      <svg
        className={variante === 'pagina' ? 'h-5 w-5' : undefined}
        viewBox="0 0 24 24"
        fill={favorito ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 20.5s-7.5-4.8-9.8-9.2C.7 8 2 4.5 5.3 3.7c2-.5 4 .3 5.2 2 .3.4.6.8.8 1.3.2-.5.5-.9.8-1.3 1.2-1.7 3.2-2.5 5.2-2 3.3.8 4.6 4.3 3.1 7.6-2.3 4.4-9.7 9.2-9.7 9.2z" />
      </svg>
    </button>
  );
}

// Precio/stock de un código puntual, en vivo — comparte el fetch de
// catalogo_publico() con CatalogoPrecios.tsx vía obtenerPreciosPublicos()
// (cacheado a nivel de módulo, un solo viaje de red por página).
function usePrecioDeCodigo(codigo: string | null) {
  const [estado, setEstado] = useState<{ precio: number | null; sinStock: boolean; pocasUnidades: boolean } | null>(null);

  useEffect(() => {
    if (!codigo) {
      setEstado(null);
      return;
    }
    let cancelado = false;
    obtenerPreciosPublicos()
      .then((datos) => {
        if (cancelado) return;
        setEstado({
          precio: datos.precios[codigo] ?? null,
          sinStock: !!datos.sinStock[codigo],
          pocasUnidades: !!datos.pocasUnidades[codigo]
        });
      })
      .catch(() => {
        if (!cancelado) setEstado(null);
      });
    return () => {
      cancelado = true;
    };
  }, [codigo]);

  return estado;
}

export function AgregarControl({
  producto,
  variante = 'card',
  onCambiarImagen
}: {
  producto: ProductoPublico;
  variante?: 'card' | 'pagina';
  onCambiarImagen?: (url: string | null) => void;
}) {
  const { agregar, cantidadDe, cantidadTotalDe, setCantidad, abrirPanel } = useCarrito();
  const [eligiendo, setEligiendo] = useState(false);

  // Una variante activo:false ("sacada de la venta" desde el panel
  // admin) nunca se ofrece como opción — sigue guardada, pero no es
  // elegible acá, ni cuenta para "cuántas opciones tiene este producto".
  const variantesActivas = (producto.variantes || []).filter((v) => v.activo);
  const [seleccion, setSeleccion] = useState<Seleccion>(() => seleccionInicial(variantesActivas));

  const tieneVariantes = variantesActivas.length > 1;
  const mostrarSelector = tieneVariantes && (variante === 'pagina' || eligiendo);
  const foto = '/' + (producto.fotos[0]?.src || '');
  const simple = {
    title: producto.titulo,
    code: producto.codigo || variantesActivas[0]?.codigo || '',
    variant: variantesActivas[0] ? etiquetaVariante(variantesActivas[0]) : ''
  };

  const ejeTalleElegible = ejeElegible(variantesActivas, 'talle');
  const ejeTipoElegible = ejeElegible(variantesActivas, 'tipo');
  // Selector progresivo con filtrado mutuo (Sprint 5) sólo tiene sentido
  // cuando los DOS ejes están en juego a la vez — con uno solo (el caso
  // de todos los productos reales hoy, "talle" nada más) no hay nada que
  // acotar entre ejes, y la lista plana de siempre (cada opción con su
  // propio +/-, sin paso de "elegir primero") sigue siendo mejor UX.
  const esMatrizDosEjes = ejeTalleElegible && ejeTipoElegible;
  const varianteResuelta = esMatrizDosEjes ? resolverVariante(variantesActivas, seleccion) : null;
  const precioResuelto = usePrecioDeCodigo(varianteResuelta?.codigo ?? null);

  useEffect(() => {
    if (!onCambiarImagen) return;
    onCambiarImagen(varianteResuelta?.imagen || null);
  }, [varianteResuelta, onCambiarImagen]);

  function elegirEje(eje: Eje, valor: string) {
    setSeleccion((actual) => {
      const siguiente: Seleccion = { ...actual, [eje]: valor };
      const otro: Eje = eje === 'talle' ? 'tipo' : 'talle';
      // Si lo que ya estaba elegido del otro eje deja de ser alcanzable
      // con esta elección nueva, se resetea — nunca se deja una
      // combinación fantasma sin código real.
      if (siguiente[otro] != null && !valoresAlcanzables(variantesActivas, otro, siguiente).includes(siguiente[otro]!)) {
        siguiente[otro] = null;
      }
      return siguiente;
    });
  }

  function alTocarAgregar(ev: React.MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    if (tieneVariantes) { setEligiendo((v) => !v); return; }
    agregar({ ...simple, img: foto });
    abrirPanel();
  }

  function cambiarSimple(n: number) {
    const sumando = n > cantidadDe(simple);
    setCantidad({ ...simple, img: foto }, n);
    if (sumando) abrirPanel();
  }

  function cambiarVariante(v: Variante, n: number) {
    const prod = { title: producto.titulo, code: v.codigo, variant: etiquetaVariante(v) };
    const sumando = n > cantidadDe(prod);
    // La imagen de la propia variante viaja al carrito cuando existe —
    // pedido original del brainstorming: "mostrar su imagen junto con
    // el color o el tipo".
    setCantidad({ ...prod, img: v.imagen || foto }, n);
    if (sumando) abrirPanel();
  }

  const totalEsteProducto = cantidadTotalDe(producto.titulo);
  const ariaLabel = tieneVariantes
    ? (totalEsteProducto > 0 ? `Editar opciones elegidas (${totalEsteProducto})` : `Elegir opción y agregar, ${variantesActivas.length} opciones`)
    : 'Agregar al carrito';

  if (variante === 'pagina') {
    return (
      <div className="flex flex-col gap-s3">
        {esMatrizDosEjes ? (
          <>
            {ejeTalleElegible && (
              <SelectorEje
                etiqueta="talle"
                valores={valoresDeEje(variantesActivas, 'talle')}
                alcanzables={valoresAlcanzables(variantesActivas, 'talle', seleccion)}
                elegido={seleccion.talle}
                onElegir={(v) => elegirEje('talle', v)}
              />
            )}
            {ejeTipoElegible && (
              <SelectorEje
                etiqueta="tipo/color"
                valores={valoresDeEje(variantesActivas, 'tipo')}
                alcanzables={valoresAlcanzables(variantesActivas, 'tipo', seleccion)}
                elegido={seleccion.tipo}
                onElegir={(v) => elegirEje('tipo', v)}
              />
            )}
            {varianteResuelta ? (
              <div className="flex items-center justify-between gap-s3 rounded-brand border border-line px-s3 py-s2">
                <span className="font-body text-fs0 font-semibold text-ink">
                  {[
                    precioResuelto?.precio != null ? fmtPrecio.format(precioResuelto.precio) : 'Consultar precio',
                    precioResuelto?.sinStock ? 'Sin stock' : precioResuelto?.pocasUnidades ? 'Quedan pocas unidades' : null
                  ].filter(Boolean).join(' · ')}
                </span>
                <PasoDeCantidad
                  n={cantidadDe({ title: producto.titulo, code: varianteResuelta.codigo, variant: etiquetaVariante(varianteResuelta) })}
                  onCambiar={(n) => cambiarVariante(varianteResuelta, n)}
                  variante="pagina"
                />
              </div>
            ) : (
              <p className="font-body text-fs-1 text-muted">
                Elegí {[ejeTalleElegible && !seleccion.talle && 'talle', ejeTipoElegible && !seleccion.tipo && 'tipo/color'].filter(Boolean).join(' y ')} para ver precio y agregar.
              </p>
            )}
          </>
        ) : tieneVariantes ? (
          <>
            <p className="font-body text-fs0 font-semibold text-ink">Elegí un {ejeTalleElegible ? 'talle' : 'tipo/color'}:</p>
            <div className="flex flex-col gap-s2">
              {variantesActivas.map((v) => (
                <div key={v.codigo} className="flex items-center justify-between gap-s3 rounded-brand border border-line px-s3 py-s2">
                  <span className="font-body text-fs0 text-ink">{etiquetaVariante(v)}</span>
                  <PasoDeCantidad
                    n={cantidadDe({ title: producto.titulo, code: v.codigo, variant: etiquetaVariante(v) })}
                    onCambiar={(n) => cambiarVariante(v, n)}
                    variante="pagina"
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-s3">
            <button
              type="button"
              onClick={alTocarAgregar}
              className="flex-1 rounded-brand bg-green px-s4 py-s3 text-center font-body text-fs1 font-semibold text-white!"
            >
              Agregar al carrito
            </button>
            {cantidadDe(simple) > 0 && <PasoDeCantidad n={cantidadDe(simple)} onCambiar={cambiarSimple} variante="pagina" />}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cart-add" onClick={(ev) => ev.stopPropagation()}>
      <button type="button" className="pcard-add" aria-label={ariaLabel} onClick={alTocarAgregar}>Agregar</button>

      {!tieneVariantes ? (
        cantidadDe(simple) > 0 && <PasoDeCantidad n={cantidadDe(simple)} onCambiar={cambiarSimple} />
      ) : mostrarSelector && (
        <div className="cart-pick-grid no-fotos">
          {variantesActivas.map((v) => (
            <div className="cart-opt" key={v.codigo}>
              <span className="cart-opt-n">{etiquetaVariante(v)}</span>
              <PasoDeCantidad n={cantidadDe({ title: producto.titulo, code: v.codigo, variant: etiquetaVariante(v) })} onCambiar={(n) => cambiarVariante(v, n)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SelectorEje({
  etiqueta,
  valores,
  alcanzables,
  elegido,
  onElegir
}: {
  etiqueta: string;
  valores: string[];
  alcanzables: string[];
  elegido: string | null;
  onElegir: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-s2">
      <p className="font-body text-fs0 font-semibold text-ink">Elegí {etiqueta}:</p>
      <div className="flex flex-wrap gap-s2">
        {valores.map((v) => {
          const alcanzable = alcanzables.includes(v);
          const estaElegido = elegido === v;
          return (
            <button
              key={v}
              type="button"
              // A propósito NO usa `disabled`: un valor no alcanzable con la
              // elección actual del OTRO eje sigue siendo clickeable —
              // elegirlo resetea esa otra elección (ver elegirEje) en vez
              // de dejar al visitante trabado sin poder cambiar de opinión
              // (con `disabled` de verdad, el click ni siquiera dispara).
              aria-pressed={estaElegido}
              aria-disabled={!alcanzable}
              onClick={() => onElegir(v)}
              className={
                'rounded-brand border px-s3 py-s2 font-body text-fs0 text-ink transition-colors ' +
                (estaElegido ? 'border-green bg-green-soft' : 'border-line') +
                (!alcanzable ? ' opacity-40' : '')
              }
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PasoDeCantidad({ n, onCambiar, variante = 'card' }: { n: number; onCambiar: (n: number) => void; variante?: 'card' | 'pagina' }) {
  if (variante === 'pagina') {
    return (
      <div className="flex shrink-0 items-center gap-s2" onClick={(ev) => ev.stopPropagation()}>
        <button type="button" aria-label="Quitar uno" disabled={n === 0} onClick={(ev) => { ev.preventDefault(); onCambiar(Math.max(0, n - 1)); }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-fs0 text-ink disabled:opacity-40">−</button>
        <span className="w-6 text-center font-body text-fs0 font-semibold text-ink">{n}</span>
        <button type="button" aria-label="Agregar uno" onClick={(ev) => { ev.preventDefault(); onCambiar(n + 1); }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-fs0 text-ink">+</button>
      </div>
    );
  }
  return (
    <div className="cart-step" onClick={(ev) => ev.stopPropagation()}>
      <button type="button" className="cart-step-b" aria-label="Quitar uno" disabled={n === 0} onClick={(ev) => { ev.preventDefault(); onCambiar(Math.max(0, n - 1)); }}>−</button>
      <span className="cart-step-n">{n}</span>
      <button type="button" className="cart-step-b" aria-label="Agregar uno" onClick={(ev) => { ev.preventDefault(); onCambiar(n + 1); }}>+</button>
    </div>
  );
}
