/* Sprint 2 de tasks/plan.md (2026-08-28) — segunda red de contención tras
 * el incidente del 404 permanente: /[mundo] y /[mundo]/[slug] dejan de
 * usar `dynamicParams = false`, para que un estado roto en la caché ISR
 * se autocorrija con el próximo visitante (render on-the-fly) en vez de
 * quedar atado hasta un redeploy. El trade-off (una URL inventada ya no
 * es 404 instantáneo del router) está cubierto por el segundo bloque de
 * este archivo: notFound() real sigue disparando igual, sólo que ahora
 * pasa por el componente en vez de por el router.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  })
}));

vi.mock('@/lib/catalogo-server', () => ({
  CATALOGO_TAG: 'catalogo',
  obtenerCatalogoPublico: vi.fn(async () => ({
    v: 1,
    mundos: [{ slug: 'cumpleanos', nombre: 'Cumpleaños', orden: 1 }],
    productos: []
  }))
}));

vi.mock('@/lib/busqueda', () => ({
  listarCatalogo: vi.fn(async () => ({ productos: [], hayMas: false }))
}));

import { notFound } from 'next/navigation';
import MundoPage from '../../app/[mundo]/page';
import ProductoPage from '../../app/[mundo]/[slug]/page';
import * as mundoModule from '../../app/[mundo]/page';
import * as productoModule from '../../app/[mundo]/[slug]/page';

// `dynamicParams` no está tipado en ninguno de los dos módulos a
// propósito (Sprint 2): sin el export, Next usa su default (`true`). El
// acceso vía índice evita que TypeScript se queje de un named export que
// ya no existe, mientras sigue afirmando en runtime que, si alguna vez
// vuelve a aparecer, no sea `false`.
describe('dynamicParams ya no bloquea rutas nuevas', () => {
  it('/[mundo] no exporta dynamicParams: false', () => {
    expect((mundoModule as Record<string, unknown>)['dynamicParams']).not.toBe(false);
  });

  it('/[mundo]/[slug] no exporta dynamicParams: false', () => {
    expect((productoModule as Record<string, unknown>)['dynamicParams']).not.toBe(false);
  });
});

describe('un slug inexistente sigue dando notFound() real (el trade-off no rompe esto)', () => {
  it('MundoPage llama notFound() para un mundo que no existe', async () => {
    await expect(MundoPage({ params: Promise.resolve({ mundo: 'no-existe' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
    expect(notFound).toHaveBeenCalled();
  });

  it('ProductoPage llama notFound() para mundo/slug inventados', async () => {
    await expect(
      ProductoPage({ params: Promise.resolve({ mundo: 'no-existe', slug: 'tampoco-existe' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
