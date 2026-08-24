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
 * favoritos (ver CuentaOverlays.tsx) — eso NO se toca en este sprint.
 *
 * Rediseño Sprint 7 (ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md):
 * panel lateral en desktop / bottom sheet en mobile, con Tailwind en vez
 * de `carrito.css` — mismo criterio que Nav/Footer en Sprint 2 (sólo
 * cambia la presentación, toda la lógica de CarritoProvider queda
 * intacta). `z-[1400]` a propósito: el `.cart-scrim` compartido
 * (public/assets/carrito.css) sigue en `z-index:1300` legacy, este panel
 * necesita superarlo.
 *
 * `<EnvioForm />` (adentro, más abajo) queda TAL CUAL con sus clases
 * legacy por ahora — reestilarlo es del Sprint 8 (carrito completo +
 * cuenta), donde de nuevo hace falta ese mismo formulario en la página
 * de carrito grande. Mientras tanto conviven un panel nuevo con un
 * formulario viejo adentro — salto visual conocido, no un bug.
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
    <aside
      role="dialog"
      aria-modal="true"
      aria-label="Mi pedido"
      className={
        'fixed inset-x-0 bottom-0 z-[1400] flex max-h-[85vh] flex-col rounded-t-brand bg-surface shadow-xl transition-transform duration-300 ' +
        'md:inset-y-0 md:right-0 md:left-auto md:top-0 md:bottom-auto md:h-full md:max-h-none md:w-full md:max-w-md md:rounded-none ' +
        (panelAbierto ? 'translate-y-0 md:translate-x-0' : 'pointer-events-none translate-y-full md:translate-x-full')
      }
    >
      <div className="flex items-center justify-between border-b border-line px-s3 py-s3">
        <h2 className="font-display text-fs2 text-ink">Mi pedido</h2>
        <button type="button" aria-label="Cerrar" onClick={cerrarPanel} className="flex h-9 w-9 items-center justify-center rounded-full font-body text-fs1 text-ink hover:bg-background-alt">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-s3 py-s3">
        {items.length === 0 ? (
          <p className="font-body text-fs0 text-muted">Todavía no agregaste nada. Tocá &quot;Agregar&quot; en los productos que te gusten.</p>
        ) : (
          <div className="flex flex-col gap-s3">
            {items.map((it) => {
              const clave = claveItem(it);
              const u = precioUnidad(it, precios);
              return (
                <div key={clave} className="flex gap-s2 border-b border-line pb-s3">
                  {it.img && <img src={it.img} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-brand bg-background object-contain" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-fs0 font-semibold text-ink">{it.title}</p>
                    {it.variant && <p className="font-body text-fs-1 text-muted">{it.variant}</p>}
                    {it.code && <p className="font-body text-fs-1 text-muted">{'Cód. ' + it.code}</p>}
                    {u > 0 ? (
                      <p className="mt-1 font-body text-fs0 font-semibold text-ink">
                        {it.qty > 1 ? `${it.qty} × ${formatoPlata(u)} = ${formatoPlata(u * it.qty)}` : formatoPlata(u)}
                      </p>
                    ) : precios ? (
                      <p className="mt-1 font-body text-fs-1 text-orange-ink">Precio a confirmar</p>
                    ) : null}
                    <div className="mt-s2 flex items-center gap-s3">
                      <div className="flex items-center gap-s2">
                        <button type="button" aria-label={'Quitar uno de ' + it.title} disabled={it.qty <= 0} onClick={() => setCantidad(it, it.qty - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink disabled:opacity-40">−</button>
                        <span className="w-5 text-center font-body text-fs0 text-ink">{it.qty}</span>
                        <button type="button" aria-label={'Agregar uno de ' + it.title} onClick={() => setCantidad(it, it.qty + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink">+</button>
                      </div>
                      <button type="button" onClick={() => quitarItem(clave)} className="font-body text-fs-1 text-muted! underline">Quitar</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {precios && items.length > 0 && (
          <div className="mt-s3 border-t border-line pt-s3">
            {resumenPedido.conPrecio === 0 ? (
              <p className="font-body text-fs0 text-orange-ink">
                {items.length === 1
                  ? 'Todavía no tenemos el precio de este producto. Te lo confirmamos por WhatsApp.'
                  : 'Todavía no tenemos el precio de estos productos. Te los confirmamos por WhatsApp.'}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between font-body text-fs0 text-ink">
                  <span>{resumenPedido.completo ? 'Total' : 'Subtotal'}</span>
                  <strong className="text-fs1">{formatoPlata(resumenPedido.suma)}</strong>
                </div>
                <p className="mt-1 font-body text-fs-1 text-muted">
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

        <div className="mt-s3 flex flex-col gap-s3">
          {sesion && (
            <p className="font-body text-fs-1 text-muted">
              Conectado como <b className="text-ink">{nombreDe(sesion) || emailDe(sesion)}</b>{' '}
              <button type="button" onClick={() => cerrarSesion()} className="text-green-ink! underline">Cerrar sesión</button>
            </p>
          )}
          <EnvioForm />
          <label className="flex flex-col gap-1">
            <span className="font-body text-fs-1 text-muted">Comentario (opcional)</span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Colores, aclaraciones…"
              className="rounded-brand border border-line px-s2 py-s2 font-body text-fs0"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-s2 border-t border-line px-s3 py-s3">
        <button type="button" onClick={verPedidoCompleto} className="text-center font-body text-fs-1 font-semibold text-green-ink! underline">
          Ver pedido completo (abre en otra pestaña)
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={enviarPedido}
          className="rounded-brand bg-green px-s4 py-s3 text-center font-body text-fs0 font-semibold text-white! disabled:opacity-60"
        >
          {enviando ? 'Enviando…' : 'Enviar pedido por WhatsApp'}
        </button>
        <p className="text-center font-body text-fs-1 text-muted">
          Te vamos a responder confirmando disponibilidad, el total y cómo pagarlo. Los pedidos de la mañana se confirman durante el día.
        </p>
      </div>
    </aside>
  );
}
