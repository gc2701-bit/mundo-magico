'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import type { ClienteResumen } from './TabClientes';

type PedidoResumen = {
  id: string;
  numero: number | null;
  created_at: string;
  estado: string;
  items: { t: string; q: number }[];
};

/**
 * Sprint D del dashboard admin — historial de compras de un cliente.
 * Lista de sólo lectura, sin reusar PedidoCard a propósito (esa tarjeta
 * está acoplada al flujo operativo — cambiar estado, asignar envío,
 * avisar por WhatsApp — que no aplica acá). Reusa la policy de admin ya
 * existente sobre `pedidos` ("Los admins ven todos los pedidos"), sin
 * necesitar una RPC nueva.
 */
export default function FichaCliente({ cliente, onVolver }: { cliente: ClienteResumen; onVolver: () => void }) {
  const [pedidos, setPedidos] = useState<PedidoResumen[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    supabaseBrowser()
      .from('pedidos')
      .select('id, numero, created_at, estado, items')
      .eq('user_id', cliente.user_id)
      .order('created_at', { ascending: false })
      .then((r: { data: PedidoResumen[] | null }) => {
        if (!cancelado) setPedidos(r.data || []);
      });
    return () => { cancelado = true; };
  }, [cliente.user_id]);

  return (
    <div>
      <Button type="button" variant="ghost" size="sm" onClick={onVolver}>← Volver</Button>
      <h2>{cliente.nombre || cliente.email}</h2>
      <p className="adm-card-meta">
        {cliente.email}
        {cliente.telefono ? ` · ${cliente.telefono}` : ''}
        {cliente.direccion ? ` · ${cliente.direccion}` : ''}
      </p>

      {pedidos === null ? (
        <p>Cargando…</p>
      ) : (
        <ul className="adm-card-items">
          {pedidos.map((p) => (
            <li key={p.id}>
              {new Date(p.created_at).toLocaleDateString('es-AR')}
              {p.numero != null ? ` — #${p.numero}` : ''} — {p.estado} — {(p.items || []).map((it) => `${it.q}x ${it.t}`).join(', ')}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
