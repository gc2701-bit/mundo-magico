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
 */

export function FavoritoBoton({ producto }: { producto: ProductoPublico }) {
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
    <button type="button" className="pcard-fav" aria-pressed={favorito} aria-label={favorito ? 'Sacar de favoritos' : 'Agregar a favoritos'} onClick={alTocar}>
      <svg viewBox="0 0 24 24" fill={favorito ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20.5s-7.5-4.8-9.8-9.2C.7 8 2 4.5 5.3 3.7c2-.5 4 .3 5.2 2 .3.4.6.8.8 1.3.2-.5.5-.9.8-1.3 1.2-1.7 3.2-2.5 5.2-2 3.3.8 4.6 4.3 3.1 7.6-2.3 4.4-9.7 9.2-9.7 9.2z" />
      </svg>
    </button>
  );
}

export function AgregarControl({ producto }: { producto: ProductoPublico }) {
  const { agregar, cantidadDe, cantidadTotalDe, setCantidad } = useCarrito();
  const [eligiendo, setEligiendo] = useState(false);

  const tieneTalles = !!(producto.talles && producto.talles.length > 1);
  const foto = '/' + (producto.fotos[0]?.src || '');
  const simple = { title: producto.titulo, code: producto.codigo || producto.talles?.[0]?.codigo || '', variant: producto.talles?.[0]?.nombre || '' };

  function alTocarAgregar(ev: React.MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    if (tieneTalles) { setEligiendo((v) => !v); return; }
    agregar({ ...simple, img: foto });
  }

  const totalEsteProducto = cantidadTotalDe(producto.titulo);
  const textoBoton = tieneTalles
    ? (totalEsteProducto > 0
      ? `${totalEsteProducto} ${totalEsteProducto === 1 ? 'unidad' : 'unidades'} · editar`
      : `Elegir entre ${producto.talles!.length} talles`)
    : 'Agregar unidad al pedido';

  return (
    <div className="cart-add" onClick={(ev) => ev.stopPropagation()}>
      <button type="button" className="pcard-add" onClick={alTocarAgregar}>{textoBoton}</button>

      {!tieneTalles ? (
        cantidadDe(simple) > 0 && (
          <PasoDeCantidad n={cantidadDe(simple)} onCambiar={(n) => setCantidad({ ...simple, img: foto }, n)} />
        )
      ) : eligiendo && (
        <div className="cart-pick-grid no-fotos">
          {producto.talles!.map((t) => (
            <div className="cart-opt" key={t.codigo}>
              <span className="cart-opt-n">{t.nombre}</span>
              <PasoDeCantidad
                n={cantidadDe({ title: producto.titulo, code: t.codigo, variant: t.nombre })}
                onCambiar={(n) => setCantidad({ title: producto.titulo, code: t.codigo, variant: t.nombre, img: foto }, n)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PasoDeCantidad({ n, onCambiar }: { n: number; onCambiar: (n: number) => void }) {
  return (
    <div className="cart-step" onClick={(ev) => ev.stopPropagation()}>
      <button type="button" className="cart-step-b" aria-label="Quitar uno" disabled={n === 0} onClick={(ev) => { ev.preventDefault(); onCambiar(Math.max(0, n - 1)); }}>−</button>
      <span className="cart-step-n">{n}</span>
      <button type="button" className="cart-step-b" aria-label="Agregar uno" onClick={(ev) => { ev.preventDefault(); onCambiar(n + 1); }}>+</button>
    </div>
  );
}
