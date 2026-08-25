/* lib/combo-composicion.ts — llamada a la RPC pública combo_composicion()
 * (Sprint 6 del plan de catálogo admin).
 */
import { describe, it, expect, vi } from 'vitest';
import { obtenerComposicionCombo } from '../../lib/combo-composicion.ts';

function sbConResultado(data, error) {
  return { rpc: vi.fn().mockResolvedValue({ data, error: error || null }) };
}

describe('combo-composicion — obtenerComposicionCombo', () => {
  it('llama a la RPC con p_codigo y devuelve las filas tal cual', async () => {
    const sb = sbConResultado([{ nombre: 'SOMBRERO', cantidad: 2 }, { nombre: 'ANTIFAZ', cantidad: 1 }]);
    const r = await obtenerComposicionCombo(sb, 'COMBO1');
    expect(sb.rpc).toHaveBeenCalledWith('combo_composicion', { p_codigo: 'COMBO1' });
    expect(r).toEqual([{ nombre: 'SOMBRERO', cantidad: 2 }, { nombre: 'ANTIFAZ', cantidad: 1 }]);
  });

  it('sin filas (combo no publicado, o no es un combo), lista vacía', async () => {
    const sb = sbConResultado([]);
    expect(await obtenerComposicionCombo(sb, 'NOCOMBO')).toEqual([]);
  });

  it('error de la RPC: lista vacía, no rompe (nunca inventa datos)', async () => {
    const sb = sbConResultado(null, new Error('permission denied'));
    expect(await obtenerComposicionCombo(sb, 'X')).toEqual([]);
  });

  it('data null sin error: lista vacía', async () => {
    const sb = sbConResultado(null);
    expect(await obtenerComposicionCombo(sb, 'X')).toEqual([]);
  });
});
