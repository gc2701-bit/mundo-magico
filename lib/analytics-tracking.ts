import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tracking propio de visitas (Sprint F del dashboard admin, ver
 * SPEC-dashboard-admin.md) — a TODOS los visitantes, anónimos incluidos
 * (a diferencia de carritos, ver lib/carrito-tracking.ts: es la única
 * forma de tener un número real de "visitas"). Sesión anónima en
 * localStorage, mismo patrón que `mm_carrito_v2` de lib/carrito.ts — un
 * UUID propio, sin relación con Google Analytics/Clarity, nunca se manda
 * IP. No bloquea la navegación si falla: nunca lanza.
 */
const SID_KEY = 'mm_analytics_sid';

function sesionAnonima(storage: Pick<Storage, 'getItem' | 'setItem'>): string {
  try {
    const existente = storage.getItem(SID_KEY);
    if (existente) return existente;
    const nueva = crypto.randomUUID();
    storage.setItem(SID_KEY, nueva);
    return nueva;
  } catch {
    return crypto.randomUUID(); // modo privado: no persiste entre vistas, pero no rompe
  }
}

export async function registrarVisita(
  sb: SupabaseClient,
  ruta: string,
  opts: { producto?: boolean; userId?: string | null } = {},
  storage: Pick<Storage, 'getItem' | 'setItem'> = typeof window !== 'undefined' ? window.localStorage : { getItem: () => null, setItem: () => {} }
): Promise<void> {
  try {
    await sb.from('analytics_eventos').insert({
      sesion_anonima: sesionAnonima(storage),
      user_id: opts.userId || null,
      tipo: opts.producto ? 'vista_producto' : 'pageview',
      ruta,
    });
  } catch {
    /* nunca bloquea la navegación */
  }
}
