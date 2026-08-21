/* lib/catalogo-mundo.ts — mundo vuelve a ser la categorización pública
 * (familia pasa a dato interno, ver plan Sprint 5.5). A diferencia de
 * familia, `mundo` YA es el slug de la URL — no hace falta reverse-lookup.
 */
import { describe, it, expect } from 'vitest';
import { mundosDisponibles, productosDeMundo, slugifyMundo } from '../../lib/catalogo-mundo.ts';

function producto(overrides) {
  return {
    id: 'x', mundo: 'globos-fiesta', subcategoriaId: null, titulo: 'X', slug: 'x',
    codigo: null, specs: null, descripcion: null, tags: null, talles: null,
    fotos: [], orden: 0, familia: null,
    ...overrides
  };
}

describe('catalogo-mundo — mundosDisponibles', () => {
  it('devuelve los slugs de mundo distintos, presentes en los productos', () => {
    const productos = [
      producto({ mundo: 'reposteria' }),
      producto({ mundo: 'globos-fiesta' }),
      producto({ mundo: 'reposteria' })
    ];
    expect(mundosDisponibles(productos)).toEqual(['globos-fiesta', 'reposteria']);
  });

  it('lista vacía si no hay productos', () => {
    expect(mundosDisponibles([])).toEqual([]);
  });

  it('orden alfabético de los slugs', () => {
    const productos = [producto({ mundo: 'especiales' }), producto({ mundo: 'combos' })];
    expect(mundosDisponibles(productos)).toEqual(['combos', 'especiales']);
  });
});

describe('catalogo-mundo — slugifyMundo (para crear un mundo nuevo desde el admin)', () => {
  it('minúscula, sin tildes, espacios a guión', () => {
    expect(slugifyMundo('Piñatas Grandes')).toBe('pinatas-grandes');
  });
  it('acentos y ñ', () => {
    expect(slugifyMundo('Decoración')).toBe('decoracion');
  });
});

describe('catalogo-mundo — productosDeMundo', () => {
  it('filtra exactamente por el slug de mundo', () => {
    const a = producto({ id: 'a', mundo: 'reposteria' });
    const b = producto({ id: 'b', mundo: 'combos' });
    expect(productosDeMundo([a, b], 'reposteria')).toEqual([a]);
  });

  it('slug sin match da lista vacía', () => {
    const productos = [producto({ mundo: 'reposteria' })];
    expect(productosDeMundo(productos, 'no-existe')).toEqual([]);
  });
});
