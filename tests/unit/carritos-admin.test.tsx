/* lib/carritos-admin.ts — clasificación completado/abandonado/en curso
 * (Sprint E del dashboard admin). "completado" lo resuelve la propia RPC
 * carritos_admin() (existe un pedido posterior al último evento) — acá
 * sólo queda decidir abandonado vs en curso según el umbral de 48hs.
 */
import { describe, it, expect } from 'vitest';
import { clasificarCarrito } from '../../lib/carritos-admin';

const AHORA = '2026-09-02T12:00:00Z';

describe('clasificarCarrito', () => {
  it('con un pedido posterior al último evento: completado, sin importar cuánto pasó', () => {
    expect(clasificarCarrito('2026-08-01T00:00:00Z', true, AHORA)).toBe('completado');
  });

  it('sin pedido y pasadas 48hs desde el último evento: abandonado', () => {
    const hace49hs = '2026-08-31T11:00:00Z'; // 49hs antes de AHORA
    expect(clasificarCarrito(hace49hs, false, AHORA)).toBe('abandonado');
  });

  it('sin pedido pero con menos de 48hs desde el último evento: en curso, no abandonado', () => {
    const hace10hs = '2026-09-02T02:00:00Z';
    expect(clasificarCarrito(hace10hs, false, AHORA)).toBe('en_curso');
  });

  it('exactamente en el umbral de 48hs: ya cuenta como abandonado', () => {
    const hace48hsExactas = '2026-08-31T12:00:00Z';
    expect(clasificarCarrito(hace48hsExactas, false, AHORA)).toBe('abandonado');
  });
});
