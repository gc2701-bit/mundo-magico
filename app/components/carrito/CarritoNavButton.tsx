'use client';

import { useCarrito } from './CarritoProvider';
import { formatoPlata } from '@/lib/carrito';

/**
 * Ícono del carrito en el header — puerto de armarAccesos() de carrito.js
 * (Sprint 5, Task 5.2). El sitio nuevo siempre tiene <Nav/> (a diferencia
 * del viejo, donde Explorar no tenía barra) — no hace falta el botón
 * flotante (.cart-fab) de respaldo.
 */
export default function CarritoNavButton() {
  const { items, resumenPedido, precios, abrirPanel } = useCarrito();
  const n = items.reduce((a, x) => a + x.qty, 0);
  const mini = resumenPedido.hayPrecios && resumenPedido.conPrecio
    ? formatoPlata(resumenPedido.suma) + (resumenPedido.sinPrecio ? '+' : '')
    : '';

  return (
    <button type="button" className={'cart-nav' + (n > 0 ? ' is-on' : '')} aria-label="Ver mi pedido" onClick={abrirPanel}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.55L21 8H6" />
        <circle cx="10" cy="20" r="1.4" /><circle cx="17.5" cy="20" r="1.4" />
      </svg>
      <span className="cart-n">{n}</span>
      {mini && <span className="cart-mini">{mini}</span>}
    </button>
  );
}
