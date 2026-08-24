'use client';

import { useEffect, useState } from 'react';
import { decodificarPedido, fotoSegura, resumenPedido, lineasEntrega, lineasParaConfirmar, type ItemPedido, type EntregaPedido } from '@/lib/pedido';

/**
 * Visor de un pedido compartido por link — puerto de pedido.html (Sprint 5,
 * Task 5.2). El pedido NO está guardado en ningún lado: viaja codificado en
 * el `#` del link (ver lib/pedido.ts) — por eso esto es un Client Component
 * que lee `location.hash`, no un Server Component con datos de Supabase.
 *
 * Todo se dibuja con JSX normal (nunca `dangerouslySetInnerHTML`): el
 * pedido llega del lado del cliente, así que lo peor que logra alguien
 * editando el link a mano es romper su propia pantalla.
 */
export default function PedidoPage() {
  const [datos, setDatos] = useState<{ items: ItemPedido[]; entrega: EntregaPedido | null } | null | undefined>(undefined);
  const [vistaCliente, setVistaCliente] = useState(false);

  useEffect(() => {
    setVistaCliente(new URLSearchParams(window.location.search).get('vista') === 'cliente');
    setDatos(decodificarPedido(window.location.hash));
  }, []);

  if (datos === undefined) return null; // primer render server/cliente, antes de leer location.hash

  if (!datos) {
    return (
      <div className="ped-wrap">
        <div className="ped-head"><h1>{vistaCliente ? 'Tu pedido' : 'Pedido del cliente'}</h1></div>
        <div id="ped-out">
          <div className="ped-bad">Este link no tiene ningún pedido. Pedile al cliente que lo mande de nuevo desde la web.</div>
        </div>
      </div>
    );
  }

  const { items, entrega } = datos;
  const { unidades, renglones, sinCodigo } = resumenPedido(items);

  return (
    <div className="ped-wrap">
      <div className="ped-head">
        <h1>{vistaCliente ? 'Tu pedido' : 'Pedido del cliente'}</h1>
        <p id="ped-sub">{renglones} producto(s) · {unidades} unidad(es) en total</p>
      </div>
      <div id="ped-out">
        <ul className="ped-list">
          {items.map((it, i) => {
            const q = Number(it.q) > 0 ? Number(it.q) : 1;
            const src = fotoSegura(it.i);
            return (
              <li className="ped-item" key={i}>
                {src && <img src={src} alt="" loading="lazy" />}
                <div className="ped-item-in">
                  <h3>{it.t || 'Producto'}</h3>
                  {it.v && <p>{it.v}</p>}
                  {it.c && <span className="ped-code">{it.c}</span>}
                </div>
                <div className="ped-q">{q}x</div>
              </li>
            );
          })}
        </ul>

        {entrega && (
          <div className="ped-meta">
            <h2>Entrega</h2>
            {lineasEntrega(entrega).map((linea, i) => <p key={i}>{'· ' + linea}</p>)}
          </div>
        )}

        {!vistaCliente && (
          <div className="ped-meta">
            <h2>Para confirmar</h2>
            {lineasParaConfirmar(sinCodigo).map((linea, i) => <p key={i}>{'· ' + linea}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
