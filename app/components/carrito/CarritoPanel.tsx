'use client';

import { useEffect } from 'react';
import { useCarrito } from './CarritoProvider';
import { useCuenta } from '../cuenta/CuentaProvider';
import { claveItem, precioUnidad, formatoPlata } from '@/lib/carrito';
import { nombreDe, emailDe } from '@/lib/cuenta';
import EnvioForm from './EnvioForm';

/**
 * Panel "Mi pedido" — puerto de armarUI()/pintarLista()/pintarTotal() de
 * carrito.js (Sprint 5, Task 5.2). Comparte el scrim con cuenta/ajustes/
 * favoritos (ver CuentaOverlays.tsx).
 */
export default function CarritoPanel() {
  const { items, panelAbierto, cerrarPanel, setCantidad, quitarItem, nota, setNota, precios, resumenPedido, enviando, enviarPedido, verPedidoCompleto } = useCarrito();
  const { sesion, cerrarSesion } = useCuenta();

  useEffect(() => {
    if (!panelAbierto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); cerrarPanel(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panelAbierto, cerrarPanel]);

  return (
    <aside className={'cart-panel' + (panelAbierto ? ' is-on' : '')} role="dialog" aria-modal="true" aria-label="Mi pedido">
      <div className="cart-head">
        <h2>Mi pedido</h2>
        <button type="button" className="cart-x" aria-label="Cerrar" onClick={cerrarPanel}>×</button>
      </div>
      <div className="cart-scroll">
        <div className="cart-body">
          {items.length === 0 ? (
            <p className="cart-empty">Todavía no agregaste nada. Tocá &quot;Agregar al pedido&quot; en los productos que te gusten.</p>
          ) : (
            items.map((it) => {
              const clave = claveItem(it);
              const u = precioUnidad(it, precios);
              return (
                <div className="cart-item" key={clave}>
                  {it.img && <img src={it.img} alt="" loading="lazy" />}
                  <div className="cart-item-in">
                    <p className="cart-item-t">{it.title}</p>
                    {it.variant && <p className="cart-item-v">{it.variant}</p>}
                    {it.code && <p className="cart-item-c">{'Cód. ' + it.code}</p>}
                    {u > 0 ? (
                      <p className="cart-item-p">
                        {it.qty > 1 ? `${it.qty} × ${formatoPlata(u)} = ${formatoPlata(u * it.qty)}` : formatoPlata(u)}
                      </p>
                    ) : precios ? (
                      <p className="cart-item-p is-pend">Precio a confirmar</p>
                    ) : null}
                    <div className="cart-qty">
                      <div className="cart-step">
                        <button type="button" className="cart-step-b" aria-label={'Quitar uno de ' + it.title} disabled={it.qty <= 0}
                          onClick={() => setCantidad(it, it.qty - 1)}>−</button>
                        <span className="cart-step-n">{it.qty}</span>
                        <button type="button" className="cart-step-b" aria-label={'Agregar uno de ' + it.title}
                          onClick={() => setCantidad(it, it.qty + 1)}>+</button>
                      </div>
                      <button type="button" className="cart-del" onClick={() => quitarItem(clave)}>Quitar</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {precios && items.length > 0 && (
          <div className="cart-total">
            {resumenPedido.conPrecio === 0 ? (
              <p className="cart-total-n cart-total-pend">
                {items.length === 1
                  ? 'Todavía no tenemos el precio de este producto. Te lo confirmamos por WhatsApp.'
                  : 'Todavía no tenemos el precio de estos productos. Te los confirmamos por WhatsApp.'}
              </p>
            ) : (
              <>
                <div className="cart-total-l">
                  <span>{resumenPedido.completo ? 'Total' : 'Subtotal'}</span>
                  <strong>{formatoPlata(resumenPedido.suma)}</strong>
                </div>
                <p className="cart-total-n">
                  {resumenPedido.sinPrecio
                    ? (resumenPedido.sinPrecio === 1
                      ? 'Falta el precio de 1 producto, te lo confirmamos por WhatsApp.'
                      : `Faltan los precios de ${resumenPedido.sinPrecio} productos, te los confirmamos por WhatsApp.`)
                    : 'No incluye el envío. Confirmamos disponibilidad y total por WhatsApp.'}
                </p>
              </>
            )}
          </div>
        )}

        <div className="cart-foot">
          {sesion && (
            <p className="cart-sesion">
              Conectado como <b>{nombreDe(sesion) || emailDe(sesion)}</b>
              <button type="button" className="cart-sesion-out" onClick={() => cerrarSesion()}>Cerrar sesión</button>
            </p>
          )}
          <EnvioForm />
          <label className="cart-field">
            <span>Comentario (opcional)</span>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Colores, aclaraciones…" />
          </label>
        </div>
      </div>
      <div className="cart-enviar">
        <button type="button" className="cart-ver-completo" onClick={verPedidoCompleto}>
          Ver pedido completo (abre en otra pestaña)
        </button>
        <button type="button" className="cart-send" disabled={enviando} onClick={enviarPedido}>
          {enviando ? 'Enviando…' : 'Enviar pedido por WhatsApp'}
        </button>
        <p className="cart-note">
          Te vamos a responder confirmando disponibilidad, el total y cómo pagarlo. Los pedidos de la mañana se confirman durante el día.
        </p>
      </div>
    </aside>
  );
}
