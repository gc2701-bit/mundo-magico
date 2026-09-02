import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tracking de carritos (Sprint E del dashboard admin, ver
 * SPEC-dashboard-admin.md) — SÓLO para usuarios logueados, a propósito:
 * carritos anónimos generan demasiado ruido para ser una señal útil de
 * "abandono" (decisión explícita del usuario del proyecto). El caller
 * (CarritoProvider) decide cuándo llamar esto — nunca sin sesión activa.
 *
 * Mismo criterio que guardarPedido() de lib/carrito.ts: no bloquea el
 * carrito si falla, nunca lanza.
 */
export type TipoEventoCarrito = 'agregado' | 'quitado' | 'checkout_iniciado';

export type EventoCarrito = {
  user_id: string;
  tipo: TipoEventoCarrito;
  titulo: string;
  codigo?: string | null;
  variante?: string | null;
  cantidad?: number | null;
};

export async function registrarEventoCarrito(sb: SupabaseClient, evento: EventoCarrito): Promise<boolean> {
  try {
    const { error } = await sb.from('carrito_eventos').insert(evento);
    return !error;
  } catch {
    return false;
  }
}
