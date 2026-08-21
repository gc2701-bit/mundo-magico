/* lib/catalogo-familia.ts — desde Sprint 5.5 sólo tipos compartidos +
 * buscarProductos (Explorar). La categorización pública (antes familia)
 * ahora es mundo, ver tests/unit/catalogo-mundo.test.js.
 */
import { describe, it, expect } from 'vitest';
import { buscarProductos } from '../../lib/catalogo-familia.ts';

function producto(overrides) {
  return {
    id: 'x', mundo: 'globos-fiesta', subcategoriaId: null, titulo: 'X', slug: 'x',
    codigo: null, specs: null, descripcion: null, tags: null, talles: null,
    fotos: [], orden: 0, familia: null,
    ...overrides
  };
}

describe('catalogo-familia — buscarProductos', () => {
  it('sin texto devuelve todos', () => {
    const productos = [producto({ titulo: 'Globo' }), producto({ titulo: 'Vaso' })];
    expect(buscarProductos(productos, '')).toEqual(productos);
  });

  it('busca por título, sin acentos ni mayúsculas', () => {
    const globo = producto({ titulo: 'Globo estándar' });
    const vaso = producto({ titulo: 'Vaso' });
    expect(buscarProductos([globo, vaso], 'ESTANDAR')).toEqual([globo]);
  });

  it('busca también dentro de specs', () => {
    const a = producto({ titulo: 'X', specs: ['Colores: rosa, celeste'] });
    const b = producto({ titulo: 'Y', specs: ['Material: madera'] });
    expect(buscarProductos([a, b], 'rosa')).toEqual([a]);
  });

  it('sin coincidencias da lista vacía', () => {
    const productos = [producto({ titulo: 'Globo' })];
    expect(buscarProductos(productos, 'inexistente')).toEqual([]);
  });
});
