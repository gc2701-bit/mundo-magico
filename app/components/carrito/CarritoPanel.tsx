'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useCarrito } from './CarritoProvider';
import { useCuenta } from '../cuenta/CuentaProvider';
import { claveItem, formatoPlata } from '@/lib/carrito';
import { nombreDe, emailDe } from '@/lib/cuenta';
import CarritoItemRow from './CarritoItemRow';
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
 * `<EnvioForm />` (adentro, más abajo) se reestiló recién en el Sprint 8
 * junto con `/carrito` (la página completa) — ambos la comparten tal
 * cual, ver EnvioForm.tsx.
 *
 * "Ver mi carrito" (Sprint 8) lleva a `/carrito`, la página completa —
 * distinto de "Ver pedido completo" más abajo, que arma un link
 * compartible con el pedido codificado en el hash (`/pedido#...`, ver
 * lib/pedido.ts) para mandarle a alguien más, no para editar el propio
 * carrito.
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
        <div>
          <h2 className="font-display text-fs2 text-ink">Mi pedido</h2>
          {items.length > 0 && (
            <Link href="/carrito" onClick={cerrarPanel} className="font-body text-fs-1 font-semibold text-green-ink! underline">
              Ver mi carrito
            </Link>
          )}
        </div>
        <button type="button" aria-label="Cerrar" onClick={cerrarPanel} className="flex h-9 w-9 items-center justify-center rounded-full font-body text-fs1 text-ink hover:bg-background-alt">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-s3 py-s3">
        {items.length === 0 ? (
          <p className="font-body text-fs0 text-muted">Todavía no agregaste nada. Tocá &quot;Agregar&quot; en los productos que te gusten.</p>
        ) : (
          <div className="flex flex-col gap-s3">
            {items.map((it) => (
              <CarritoItemRow
                key={claveItem(it)}
                item={it}
                precios={precios}
                onCantidad={(n) => setCantidad(it, n)}
                onQuitar={() => quitarItem(claveItem(it))}
              />
            ))}
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
