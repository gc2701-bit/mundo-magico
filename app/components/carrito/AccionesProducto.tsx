'use client';

import { useEffect, useState } from 'react';
import { useCarrito } from './CarritoProvider';
import { cargarFavoritos, guardarFavoritos, toggleFavorito, claveFavorito } from '@/lib/favoritos';
import type { ProductoPublico } from '@/lib/catalogo-familia';

/**
 * Botón "Agregar al pedido" + corazón de favoritos de una tarjeta — puerto
 * de montarControl()/montarFavoritos() de carrito.js (Sprint 5, Task 5.2).
 * Dos componentes separados (no uno) porque van en contenedores distintos
 * de la tarjeta (.pcard-ph vs .pcard-body — mismo layout que el sitio
 * viejo, ver ProductoCard.tsx).
 *
 * Simplificación consciente frente al sitio viejo: acá "opciones" es sólo
 * `producto.talles` (el único caso de variantes que sobrevivió a la
 * migración de datos, ver spec sección 3/4 — una galería de fotos ya NO es
 * una elección de color con código propio, es sólo fotos del mismo
 * producto). Con talles se elige cantidad por talle en un desplegable
 * dentro de la tarjeta, en vez del picker modal aparte del sitio viejo.
 *
 * `variante` (Sprint 7): mismo componente para la card compacta del
 * catálogo (`'card'`, default — clases legacy `carrito.css`/`v2.css`) y
 * la ficha de producto a página completa (`'pagina'` — Tailwind, talles
 * siempre visibles en vez de detrás de un toggle, botón más grande).
 * Reusar en vez de duplicar: la lógica de carrito/favoritos es idéntica,
 * sólo cambia la presentación.
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

export function AgregarControl({ producto, variante = 'card' }: { producto: ProductoPublico; variante?: 'card' | 'pagina' }) {
  const { agregar, cantidadDe, cantidadTotalDe, setCantidad, abrirPanel } = useCarrito();
  const [eligiendo, setEligiendo] = useState(false);

  const tieneTalles = !!(producto.talles && producto.talles.length > 1);
  const mostrarTalles = tieneTalles && (variante === 'pagina' || eligiendo);
  const foto = '/' + (producto.fotos[0]?.src || '');
  const simple = { title: producto.titulo, code: producto.codigo || producto.talles?.[0]?.codigo || '', variant: producto.talles?.[0]?.nombre || '' };

  function alTocarAgregar(ev: React.MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    if (tieneTalles) { setEligiendo((v) => !v); return; }
    agregar({ ...simple, img: foto });
    abrirPanel();
  }

  function cambiarSimple(n: number) {
    const sumando = n > cantidadDe(simple);
    setCantidad({ ...simple, img: foto }, n);
    if (sumando) abrirPanel();
  }

  function cambiarTalle(t: { nombre: string; codigo: string }, n: number) {
    const prod = { title: producto.titulo, code: t.codigo, variant: t.nombre };
    const sumando = n > cantidadDe(prod);
    setCantidad({ ...prod, img: foto }, n);
    if (sumando) abrirPanel();
  }

  // Botón uniforme "Agregar" en todos los casos (antes cambiaba de texto
  // según estado — "Elegir entre N talles", "N unidades · editar" — pedido
  // explícito del usuario, 2026-08-24: siempre el mismo texto, siempre en
  // el mismo lugar de la card). El comportamiento no cambia: con talles
  // abre el selector, sin talles agrega directo. aria-label mantiene el
  // detalle para lectores de pantalla.
  const totalEsteProducto = cantidadTotalDe(producto.titulo);
  const ariaLabel = tieneTalles
    ? (totalEsteProducto > 0 ? `Editar talles elegidos (${totalEsteProducto})` : `Elegir talle y agregar, ${producto.talles!.length} opciones`)
    : 'Agregar al carrito';

  if (variante === 'pagina') {
    return (
      <div className="flex flex-col gap-s3">
        {tieneTalles ? (
          <>
            <p className="font-body text-fs0 font-semibold text-ink">Elegí un talle:</p>
            <div className="flex flex-col gap-s2">
              {producto.talles!.map((t) => (
                <div key={t.codigo} className="flex items-center justify-between gap-s3 rounded-brand border border-line px-s3 py-s2">
                  <span className="font-body text-fs0 text-ink">{t.nombre}</span>
                  <PasoDeCantidad n={cantidadDe({ title: producto.titulo, code: t.codigo, variant: t.nombre })} onCambiar={(n) => cambiarTalle(t, n)} variante="pagina" />
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

      {!tieneTalles ? (
        cantidadDe(simple) > 0 && <PasoDeCantidad n={cantidadDe(simple)} onCambiar={cambiarSimple} />
      ) : mostrarTalles && (
        <div className="cart-pick-grid no-fotos">
          {producto.talles!.map((t) => (
            <div className="cart-opt" key={t.codigo}>
              <span className="cart-opt-n">{t.nombre}</span>
              <PasoDeCantidad n={cantidadDe({ title: producto.titulo, code: t.codigo, variant: t.nombre })} onCambiar={(n) => cambiarTalle(t, n)} />
            </div>
          ))}
        </div>
      )}
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
