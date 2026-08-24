'use client';

import Link from 'next/link';
import { useCarrito } from '../components/carrito/CarritoProvider';
import { useCuenta } from '../components/cuenta/CuentaProvider';
import { claveItem, formatoPlata } from '@/lib/carrito';
import { nombreDe, emailDe } from '@/lib/cuenta';
import CarritoItemRow from '../components/carrito/CarritoItemRow';
import EnvioForm from '../components/carrito/EnvioForm';
import EmptyState from '../components/EmptyState';
import Breadcrumbs from '../components/Breadcrumbs';

/**
 * Página de carrito completa (Sprint 8, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md) —
 * la vista en vivo del carrito actual (`useCarrito()`, editable). NO es
 * lo mismo que `/pedido` (lib/pedido.ts): esa es un visor de sólo
 * lectura de un pedido YA armado, codificado en el link — un snapshot
 * para compartir, no el carrito real. Client Component a propósito:
 * necesita el estado vivo de CarritoProvider, no hay nada que server-
 * renderizar acá (mismo criterio que /pedido).
 */
export default function CarritoPage() {
  const { items, setCantidad, quitarItem, nota, setNota, precios, resumenPedido, enviando, enviarPedido, verPedidoCompleto } = useCarrito();
  const { sesion, cerrarSesion } = useCuenta();

  return (
    <main className="wrap py-s5">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Tu carrito' }]} />
      <h1 className="mt-s2 mb-s5 font-display text-fs3 text-ink">Tu carrito</h1>

      {items.length === 0 ? (
        <EmptyState
          icono="🛒"
          titulo="Todavía no agregaste nada"
          descripcion="Explorá el catálogo y armá tu pedido."
          accion={{ label: 'Ver mundos', href: '/explorar' }}
        />
      ) : (
        <div className="flex flex-col gap-s5 md:flex-row md:items-start">
          <div className="flex flex-1 flex-col gap-s3">
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

          <div className="flex flex-col gap-s3 rounded-brand border border-line bg-surface p-s4 md:w-96 md:shrink-0">
            {precios && (
              <div>
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
                      <strong className="text-fs2">{formatoPlata(resumenPedido.suma)}</strong>
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

            <button
              type="button"
              disabled={enviando}
              onClick={enviarPedido}
              className="rounded-brand bg-green px-s4 py-s3 text-center font-body text-fs0 font-semibold text-white! disabled:opacity-60"
            >
              {enviando ? 'Enviando…' : 'Continuar compra'}
            </button>
            <button type="button" onClick={verPedidoCompleto} className="text-center font-body text-fs-1 font-semibold text-green-ink! underline">
              Ver pedido completo (abre en otra pestaña)
            </button>
            <p className="text-center font-body text-fs-1 text-muted">
              Te vamos a responder confirmando disponibilidad, el total y cómo pagarlo. Los pedidos de la mañana se confirman durante el día.
            </p>
            <Link href="/explorar" className="text-center font-body text-fs-1 text-muted! underline">
              Seguir comprando
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
