/* lib/analytics-tracking.ts — Sprint F del dashboard admin: tracking
 * propio de visitas, todos los visitantes (anónimos incluidos, a
 * diferencia de carritos — ver lib/carrito-tracking.ts). Sesión anónima
 * en localStorage (mismo patrón que mm_carrito_v2 de lib/carrito.ts), sin
 * relación con Google Analytics/Clarity, nunca guarda IP.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registrarVisita } from '../../lib/analytics-tracking';

function fakeStorage() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => (map.has(k) ? map.get(k)! : null), setItem: (k: string, v: string) => { map.set(k, v); } };
}

afterEach(() => vi.restoreAllMocks());

describe('registrarVisita', () => {
  it('inserta un pageview con una sesión anónima nueva, reusada entre llamadas', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const sb = { from: () => ({ insert }) } as never;
    const storage = fakeStorage();

    await registrarVisita(sb, '/', {}, storage);
    await registrarVisita(sb, '/carrito', {}, storage);

    expect(insert).toHaveBeenCalledTimes(2);
    const [primera] = insert.mock.calls[0];
    const [segunda] = insert.mock.calls[1];
    expect(primera.sesion_anonima).toBe(segunda.sesion_anonima); // misma sesión, no una nueva por llamada
    expect(primera.tipo).toBe('pageview');
    expect(primera.ruta).toBe('/');
    expect(primera.user_id).toBeNull();
  });

  it('con producto:true registra "vista_producto" en vez de "pageview"', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const sb = { from: () => ({ insert }) } as never;

    await registrarVisita(sb, '/globos-fiesta/abanico-luminoso', { producto: true }, fakeStorage());

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'vista_producto', ruta: '/globos-fiesta/abanico-luminoso' }));
  });

  it('con sesión logueada, manda el user_id', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const sb = { from: () => ({ insert }) } as never;

    await registrarVisita(sb, '/', { userId: 'u1' }, fakeStorage());

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1' }));
  });

  it('si falla el insert, no lanza (nunca bloquea la navegación)', async () => {
    const sb = { from: () => ({ insert: () => Promise.reject(new Error('boom')) }) } as never;
    await expect(registrarVisita(sb, '/', {}, fakeStorage())).resolves.toBeUndefined();
  });
});
