/* lib/catalogo-familia.ts — familias reemplazan mundos/subcategorías (ver
 * docs/superpowers/specs/2026-08-20-nextjs-migracion-familias-design.md,
 * sección 4). Sprint 2, Task 2.1.
 */
import { describe, it, expect } from 'vitest';
import {
  slugifyFamilia,
  familiasDisponibles,
  productosDeFamilia,
  familiaDesdeSlug
} from '../../lib/catalogo-familia.ts';

function producto(overrides) {
  return {
    id: 'x', pagina: 'p.html', subcategoriaId: null, titulo: 'X', slug: 'x',
    codigo: null, specs: null, descripcion: null, tags: null, talles: null,
    fotos: [], orden: 0, familia: null,
    ...overrides
  };
}

describe('catalogo-familia — slugifyFamilia', () => {
  it('minúscula, sin tildes, espacios a guión', () => {
    expect(slugifyFamilia('ANTEOJOS ESPECIAL')).toBe('anteojos-especial');
  });
  it('acentos y ñ', () => {
    expect(slugifyFamilia('DECORACIÓN')).toBe('decoracion');
  });
});

describe('catalogo-familia — familiasDisponibles', () => {
  it('devuelve las familias distintas, ordenadas, sin nulls', () => {
    const productos = [
      producto({ familia: 'RUIDO' }),
      producto({ familia: 'LUMINOSOS' }),
      producto({ familia: null }),
      producto({ familia: 'RUIDO' })
    ];
    expect(familiasDisponibles(productos)).toEqual(['LUMINOSOS', 'RUIDO']);
  });

  it('lista vacía si ningún producto tiene familia', () => {
    expect(familiasDisponibles([producto({ familia: null })])).toEqual([]);
  });
});

describe('catalogo-familia — productosDeFamilia', () => {
  it('filtra exactamente por familia', () => {
    const a = producto({ id: 'a', familia: 'RUIDO' });
    const b = producto({ id: 'b', familia: 'LUMINOSOS' });
    expect(productosDeFamilia([a, b], 'RUIDO')).toEqual([a]);
  });
});

describe('catalogo-familia — familiaDesdeSlug', () => {
  it('resuelve el slug a la familia original (mayúsculas/tildes)', () => {
    const productos = [producto({ familia: 'DECORACIÓN' }), producto({ familia: 'RUIDO' })];
    expect(familiaDesdeSlug(productos, 'decoracion')).toBe('DECORACIÓN');
  });

  it('slug sin match da null', () => {
    const productos = [producto({ familia: 'RUIDO' })];
    expect(familiaDesdeSlug(productos, 'no-existe')).toBeNull();
  });
});
