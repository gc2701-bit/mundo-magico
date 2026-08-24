/* lib/admin-catalogo.ts — Sprint 4 (panel admin nuevo, catálogo unificado). */
import { describe, it, expect } from 'vitest';
import {
  validarCodigo,
  codigoNormalizado,
  codigosDe,
  codigosUsadosPorOtros,
  codigosBorrables,
  familiasVistas,
  contarSinFamilia,
  rutasDeStorage,
  STORAGE_PREFIX
} from '../../lib/admin-catalogo.ts';

function producto(overrides) {
  return { id: 'x', codigo: null, talles: null, familia: null, ...overrides };
}

describe('admin-catalogo — validarCodigo', () => {
  it('vacío es válido (permite sacarle el código a un producto)', () => {
    expect(validarCodigo('')).toBeNull();
    expect(validarCodigo('   ')).toBeNull();
  });
  it('longitud normal es válida', () => {
    expect(validarCodigo('04375')).toBeNull();
  });
  it('más de 16 caracteres es inválido', () => {
    expect(validarCodigo('12345678901234567')).not.toBeNull();
  });
});

describe('admin-catalogo — codigoNormalizado', () => {
  it('trimea y vacío -> null', () => {
    expect(codigoNormalizado('  04375  ')).toBe('04375');
    expect(codigoNormalizado('   ')).toBeNull();
  });
});

describe('admin-catalogo — codigosDe', () => {
  it('producto simple', () => {
    expect(codigosDe(producto({ codigo: 'A' }))).toEqual(['A']);
  });
  it('producto de talles', () => {
    const talles = [{ nombre: 'Chico', codigo: 'A' }, { nombre: 'Grande', codigo: 'B' }];
    expect(codigosDe(producto({ talles }))).toEqual(['A', 'B']);
  });
  it('sin código ni talles', () => {
    expect(codigosDe(producto({}))).toEqual([]);
  });
});

describe('admin-catalogo — codigosUsadosPorOtros / codigosBorrables', () => {
  it('código compartido por otro producto no es borrable', () => {
    const a = producto({ id: 'a', codigo: '11963' });
    const b = producto({ id: 'b', codigo: '11963' });
    const todos = [a, b];
    expect(codigosUsadosPorOtros(a, todos)).toEqual(new Set(['11963']));
    expect(codigosBorrables(a, todos)).toEqual([]);
  });

  it('código exclusivo de un producto sí es borrable', () => {
    const a = producto({ id: 'a', codigo: 'UNICO' });
    const b = producto({ id: 'b', codigo: 'OTRO' });
    const todos = [a, b];
    expect(codigosBorrables(a, todos)).toEqual(['UNICO']);
  });

  it('talles: cada código se chequea por separado', () => {
    const a = producto({ id: 'a', talles: [{ nombre: 'Chico', codigo: 'X' }, { nombre: 'Grande', codigo: 'Y' }] });
    const b = producto({ id: 'b', codigo: 'Y' });
    const todos = [a, b];
    expect(codigosBorrables(a, todos)).toEqual(['X']);
  });
});

describe('admin-catalogo — familiasVistas / contarSinFamilia', () => {
  it('familias distintas ordenadas, sin nulls', () => {
    const productos = [producto({ familia: 'RUIDO' }), producto({ familia: null }), producto({ familia: 'LUMINOSOS' })];
    expect(familiasVistas(productos)).toEqual(['LUMINOSOS', 'RUIDO']);
  });

  it('cuenta los que no tienen familia', () => {
    const productos = [producto({ familia: 'RUIDO' }), producto({ familia: null }), producto({ familia: null })];
    expect(contarSinFamilia(productos)).toBe(2);
  });
});

describe('admin-catalogo — rutasDeStorage', () => {
  it('sólo las fotos que viven en el bucket de Storage, con la ruta relativa', () => {
    const fotos = [
      { src: STORAGE_PREFIX + 'disfraces-v2/producto-123.webp' },
      { src: 'productos/3.%20Disfraces/foto.webp' }
    ];
    expect(rutasDeStorage(fotos)).toEqual(['disfraces-v2/producto-123.webp']);
  });

  it('sin fotos de Storage, lista vacía', () => {
    expect(rutasDeStorage([{ src: 'productos/x.webp' }])).toEqual([]);
  });
});
