'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Admin = { user_id: string; email: string };

/**
 * Sprint D del dashboard admin — agregar/quitar admins. public.admins no
 * tiene policy de INSERT/DELETE (sólo "un admin se ve a sí mismo"): todo
 * pasa por las RPCs de supabase/usuarios_00_admin_clientes.sql, nunca por
 * un insert/delete directo del cliente.
 */
export default function TabAdministradores() {
  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargar = useCallback(async () => {
    const { data } = await supabaseBrowser().rpc('admin_listar_admins');
    setAdmins(data || []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje('');
    setEnviando(true);
    const sb = supabaseBrowser();
    const { data: encontrados } = await sb.rpc('admin_buscar_usuario_por_email', { p_email: email });
    const encontrado = (encontrados || [])[0];
    if (!encontrado) {
      setEnviando(false);
      setMensaje('No existe una cuenta con ese email.');
      return;
    }
    const { error } = await sb.rpc('admin_agregar', { p_user_id: encontrado.id });
    setEnviando(false);
    if (error) { setMensaje('No se pudo agregar.'); return; }
    setEmail('');
    await cargar();
  }

  async function quitar(userId: string) {
    if (!window.confirm('¿Quitar a esta cuenta como administrador?')) return;
    setMensaje('');
    const { error } = await supabaseBrowser().rpc('admin_quitar', { p_user_id: userId });
    if (error) { setMensaje(error.message || 'No se pudo quitar.'); return; }
    await cargar();
  }

  return (
    <div>
      <form onSubmit={agregar} className="adm-detalle-campos-editables">
        <div className="adm-detalle-campo">
          <label>
            Agregar por email
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
        </div>
        <Button type="submit" disabled={enviando}>Agregar</Button>
      </form>

      {mensaje && <p className="adm-msg adm-msg-error">{mensaje}</p>}

      {admins === null ? (
        <p>Cargando…</p>
      ) : (
        <ul className="adm-card-items">
          {admins.map((a) => (
            <li key={a.user_id}>
              {a.email}{' '}
              <Button type="button" variant="ghost" size="sm" onClick={() => quitar(a.user_id)}>Quitar</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
