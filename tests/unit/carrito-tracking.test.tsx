/* lib/carrito-tracking.ts — Sprint E del dashboard admin: tracking de
 * carritos SÓLO para usuarios logueados (decisión explícita del usuario:
 * anónimos generan demasiado ruido). Mismo criterio que guardarPedido()
 * de lib/carrito.ts: nunca bloquea el carrito si falla.
 */
import { describe, it, expect, vi } from 'vitest';
import { registrarEventoCarrito } from '../../lib/carrito-tracking';

describe('registrarEventoCarrito', () => {
  it('inserta el evento y devuelve true si no hay error', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const sb = { from: () => ({ insert }) } as never;

    const ok = await registrarEventoCarrito(sb, {
      user_id: 'u1', tipo: 'agregado', codigo: '111', titulo: 'Globo', variante: null, cantidad: 2,
    });

    expect(ok).toBe(true);
    expect(insert).toHaveBeenCalledWith({
      user_id: 'u1', tipo: 'agregado', codigo: '111', titulo: 'Globo', variante: null, cantidad: 2,
    });
  });

  it('si falla el insert, devuelve false sin lanzar (no bloquea el carrito)', async () => {
    const sb = { from: () => ({ insert: () => Promise.resolve({ error: new Error('sin sesión') }) }) } as never;

    const ok = await registrarEventoCarrito(sb, { user_id: 'u1', tipo: 'quitado', titulo: 'Globo' });

    expect(ok).toBe(false);
  });

  it('si tira una excepción, también devuelve false', async () => {
    const sb = { from: () => { throw new Error('boom'); } } as never;

    const ok = await registrarEventoCarrito(sb, { user_id: 'u1', tipo: 'checkout_iniciado', titulo: 'Globo' });

    expect(ok).toBe(false);
  });
});
