'use client';

import { useCuenta } from './CuentaProvider';
import CuentaModal from './CuentaModal';
import AjustesModal from './AjustesModal';
import FavoritosPanel from './FavoritosPanel';

/**
 * Monta una sola vez, al pie del layout: el fondo oscuro compartido
 * (.cart-scrim, mismo criterio que assets/carrito.js — un solo scrim para
 * cuenta/ajustes/favoritos y, en Task 5.2, también el panel del pedido) y
 * los tres modales de cuenta, siempre en el DOM y controlados por clase
 * `is-on` (igual que el sitio viejo).
 */
export default function CuentaOverlays() {
  const { modalAbierto, ajustesAbierto, favoritosAbierto, cerrarModal, tomarPendiente, cerrarAjustes, cerrarFavoritos } = useCuenta();
  const mostrarScrim = modalAbierto || ajustesAbierto || favoritosAbierto;

  function onScrimClick() {
    if (modalAbierto) { tomarPendiente(); cerrarModal(); }
    if (ajustesAbierto) cerrarAjustes();
    if (favoritosAbierto) cerrarFavoritos();
  }

  return (
    <>
      <div className={'cart-scrim' + (mostrarScrim ? ' is-on' : '')} onClick={onScrimClick} />
      <CuentaModal />
      <AjustesModal />
      <FavoritosPanel />
    </>
  );
}
