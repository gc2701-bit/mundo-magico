'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import FichaCliente from './FichaCliente';

export type ClienteResumen = {
  user_id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  direccion: string | null;
  cantidad_pedidos: number;
  ultimo_pedido: string;
};

/**
 * Sprint D del dashboard admin — no hay tabla de perfil de cliente propia
 * todavía (ver SPEC-dashboard-admin.md sección 2): la lista se arma desde
 * clientes_resumen() (agregado de `pedidos`), un cliente por cada user_id
 * distinto con al menos un pedido. Sin paginar por ahora — a revisar si el
 * volumen real de clientes lo pide.
 */
export default function TabClientes() {
  const [clientes, setClientes] = useState<ClienteResumen[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState<ClienteResumen | null>(null);

  useEffect(() => {
    supabaseBrowser().rpc('clientes_resumen').then(({ data }: { data: ClienteResumen[] | null }) => {
      setClientes(data || []);
    });
  }, []);

  const filtrados = useMemo(() => {
    if (!clientes) return [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.telefono || '').toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  }, [clientes, busqueda]);

  if (seleccionado) {
    return <FichaCliente cliente={seleccionado} onVolver={() => setSeleccionado(null)} />;
  }

  return (
    <div>
      <Input
        placeholder="Buscar por nombre, teléfono o email"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {clientes === null ? (
        <p>Cargando…</p>
      ) : (
        <ul className="adm-card-items">
          {filtrados.map((c) => (
            <li key={c.user_id}>
              <button type="button" onClick={() => setSeleccionado(c)}>
                {c.nombre || c.email} — {c.cantidad_pedidos} pedido{c.cantidad_pedidos === 1 ? '' : 's'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
