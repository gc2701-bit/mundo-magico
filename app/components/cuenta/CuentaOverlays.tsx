'use client';

import { useCuenta } from './CuentaProvider';
import CuentaModal from './CuentaModal';
import AjustesModal from './AjustesModal';
import FavoritosPanel from './FavoritosPanel';
import { useCarrito } from '../carrito/CarritoProvider';
import CarritoPanel from '../carrito/CarritoPanel';

/**
 * Monta una sola vez, al pie del layout: el fondo oscuro compartido
 * (.cart-scrim, mismo criterio que assets/carrito.js — un solo scrim para
 * cuenta/ajustes/favoritos y, desde Task 5.2, también el panel del pedido)
 * y los overlays de cuenta + carrito, siempre en el DOM y controlados por
 * clase `is-on` (igual que el sitio viejo).
 */
export default function CuentaOverlays() {
  const { modalAbierto, ajustesAbierto, favoritosAbierto, cerrarModal, tomarPendiente, cerrarAjustes, cerrarFavoritos } = useCuenta();
  const { panelAbierto, cerrarPanel } = useCarrito();
  const mostrarScrim = modalAbierto || ajustesAbierto || favoritosAbierto || panelAbierto;

  function onScrimClick() {
    if (modalAbierto) { tomarPendiente(); cerrarModal(); }
    if (ajustesAbierto) cerrarAjustes();
    if (favoritosAbierto) cerrarFavoritos();
    if (panelAbierto) cerrarPanel();
  }

  return (
    <>
      <div className={'cart-scrim' + (mostrarScrim ? ' is-on' : '')} onClick={onScrimClick} />
      <CuentaModal />
      <AjustesModal />
      <FavoritosPanel />
      <CarritoPanel />
    </>
  );
}
