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
  STORAGE_PREFIX,
  precioStockDe,
  ordenarCatalogo,
  filtrarCatalogo,
  SIN_FAMILIA,
  estadoSeleccionEncabezado,
  redondearPrecio,
  codigosBorrablesLote,
  nuevaVarianteVacia,
  validarFilaVariante,
  primerErrorDeVariantes,
  normalizarVariantes
} from '../../lib/admin-catalogo.ts';

function producto(overrides) {
  return { id: 'x', codigo: null, variantes: null, familia: null, ...overrides };
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
    const variantes = [{ talle: 'Chico', codigo: 'A', activo: true }, { talle: 'Grande', codigo: 'B', activo: true }];
    expect(codigosDe(producto({ variantes }))).toEqual(['A', 'B']);
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
    const a = producto({ id: 'a', variantes: [{ talle: 'Chico', codigo: 'X', activo: true }, { talle: 'Grande', codigo: 'Y', activo: true }] });
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

describe('admin-catalogo — precioStockDe', () => {
  it('producto simple con precio y stock conocidos', () => {
    const mapa = { A: { precio: 1000, stock: 5 } };
    expect(precioStockDe(producto({ codigo: 'A' }), mapa)).toEqual({ precio: 1000, stock: 5 });
  });

  it('código sin dato en el mapa -> null, no inventa nada', () => {
    expect(precioStockDe(producto({ codigo: 'A' }), {})).toEqual({ precio: null, stock: null });
  });

  it('variantes: usa el mínimo precio entre las que tienen dato', () => {
    const variantes = [{ talle: 'Chico', codigo: 'A', activo: true }, { talle: 'Grande', codigo: 'B', activo: true }];
    const mapa = { A: { precio: 2000, stock: 3 }, B: { precio: 3500, stock: 1 } };
    expect(precioStockDe(producto({ variantes }), mapa)).toEqual({ precio: 2000, stock: 1 });
  });

  it('variante desactivada igual cuenta para precio/stock — el admin ve todo, a diferencia del selector público', () => {
    const variantes = [{ talle: 'Chico', codigo: 'A', activo: false }, { talle: 'Grande', codigo: 'B', activo: true }];
    const mapa = { A: { precio: 1000, stock: 9 }, B: { precio: 3500, stock: 1 } };
    expect(precioStockDe(producto({ variantes }), mapa)).toEqual({ precio: 1000, stock: 1 });
  });

  it('stock null en un código (ej. combo sin fórmula validada) no rompe el mínimo de los demás', () => {
    const variantes = [{ talle: 'Chico', codigo: 'A', activo: true }, { talle: 'Grande', codigo: 'B', activo: true }];
    const mapa = { A: { precio: 2000, stock: null }, B: { precio: 3500, stock: 4 } };
    expect(precioStockDe(producto({ variantes }), mapa)).toEqual({ precio: 2000, stock: 4 });
  });

  it('ningún código con stock cargado -> stock null aunque el precio se conozca', () => {
    const mapa = { A: { precio: 2000, stock: null } };
    expect(precioStockDe(producto({ codigo: 'A' }), mapa)).toEqual({ precio: 2000, stock: null });
  });
});

function fila(overrides) {
  return {
    id: 'x', codigo: '001', titulo: 'Producto', familia: 'RUIDO',
    mundoSlug: 'cotillon', mundoNombre: 'Cotillón',
    stock: 10, precio: 1000, publicado: true,
    ...overrides
  };
}

describe('admin-catalogo — ordenarCatalogo', () => {
  it('código asc/desc', () => {
    const filas = [fila({ codigo: '002' }), fila({ codigo: '001' })];
    expect(ordenarCatalogo(filas, 'codigo', 'asc').map((f) => f.codigo)).toEqual(['001', '002']);
    expect(ordenarCatalogo(filas, 'codigo', 'desc').map((f) => f.codigo)).toEqual(['002', '001']);
  });

  it('nombre (título) alfabético, sin distinguir acentos raros de Intl', () => {
    const filas = [fila({ id: 'a', titulo: 'Zapallo' }), fila({ id: 'b', titulo: 'Antifaz' })];
    expect(ordenarCatalogo(filas, 'titulo', 'asc').map((f) => f.id)).toEqual(['b', 'a']);
  });

  it('familia: null va como string vacío, no rompe localeCompare', () => {
    const filas = [fila({ id: 'a', familia: 'RUIDO' }), fila({ id: 'b', familia: null })];
    expect(ordenarCatalogo(filas, 'familia', 'asc').map((f) => f.id)).toEqual(['b', 'a']);
  });

  it('mundo: ordena por el nombre de display, no por el slug', () => {
    const filas = [
      fila({ id: 'a', mundoSlug: 'z-slug', mundoNombre: 'Antifaces' }),
      fila({ id: 'b', mundoSlug: 'a-slug', mundoNombre: 'Zapatos' })
    ];
    expect(ordenarCatalogo(filas, 'mundo', 'asc').map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('stock/precio: nulls siempre al final, en cualquier dirección', () => {
    const filas = [fila({ id: 'a', stock: null }), fila({ id: 'b', stock: 5 }), fila({ id: 'c', stock: 2 })];
    expect(ordenarCatalogo(filas, 'stock', 'asc').map((f) => f.id)).toEqual(['c', 'b', 'a']);
    expect(ordenarCatalogo(filas, 'stock', 'desc').map((f) => f.id)).toEqual(['b', 'c', 'a']);
  });

  it('estado: publicado antes que oculto en asc', () => {
    const filas = [fila({ id: 'a', publicado: false }), fila({ id: 'b', publicado: true })];
    expect(ordenarCatalogo(filas, 'estado', 'asc').map((f) => f.id)).toEqual(['b', 'a']);
  });

  it('no muta el array original', () => {
    const filas = [fila({ codigo: '002' }), fila({ codigo: '001' })];
    const original = [...filas];
    ordenarCatalogo(filas, 'codigo', 'asc');
    expect(filas).toEqual(original);
  });
});

describe('admin-catalogo — filtrarCatalogo', () => {
  it('sin filtros, devuelve todo', () => {
    const filas = [fila({ id: 'a' }), fila({ id: 'b' })];
    expect(filtrarCatalogo(filas, {})).toHaveLength(2);
  });

  it('búsqueda por título o código, sin importar mayúsculas', () => {
    const filas = [fila({ id: 'a', titulo: 'Anteojo estrella', codigo: '001' }), fila({ id: 'b', titulo: 'Sombrero', codigo: '61147' })];
    expect(filtrarCatalogo(filas, { busqueda: 'ANTEOJO' }).map((f) => f.id)).toEqual(['a']);
    expect(filtrarCatalogo(filas, { busqueda: '61147' }).map((f) => f.id)).toEqual(['b']);
  });

  it('familia exacta', () => {
    const filas = [fila({ id: 'a', familia: 'RUIDO' }), fila({ id: 'b', familia: 'LUMINOSOS' })];
    expect(filtrarCatalogo(filas, { familia: 'RUIDO' }).map((f) => f.id)).toEqual(['a']);
  });

  it('SIN_FAMILIA trae sólo los que no tienen familia', () => {
    const filas = [fila({ id: 'a', familia: 'RUIDO' }), fila({ id: 'b', familia: null })];
    expect(filtrarCatalogo(filas, { familia: SIN_FAMILIA }).map((f) => f.id)).toEqual(['b']);
  });

  it('mundo por slug', () => {
    const filas = [fila({ id: 'a', mundoSlug: 'cotillon' }), fila({ id: 'b', mundoSlug: 'disfraces' })];
    expect(filtrarCatalogo(filas, { mundoSlug: 'disfraces' }).map((f) => f.id)).toEqual(['b']);
  });

  it('combina búsqueda + familia + mundo a la vez', () => {
    const filas = [
      fila({ id: 'a', titulo: 'Anteojo estrella', familia: 'RUIDO', mundoSlug: 'cotillon' }),
      fila({ id: 'b', titulo: 'Anteojo redondo', familia: 'LUMINOSOS', mundoSlug: 'cotillon' })
    ];
    expect(filtrarCatalogo(filas, { busqueda: 'anteojo', familia: 'RUIDO', mundoSlug: 'cotillon' }).map((f) => f.id)).toEqual(['a']);
  });
});

describe('admin-catalogo — estadoSeleccionEncabezado', () => {
  it('sin filas, ninguno', () => {
    expect(estadoSeleccionEncabezado([], new Set())).toBe('ninguno');
  });

  it('ninguna fila seleccionada', () => {
    const filas = [fila({ id: 'a' }), fila({ id: 'b' })];
    expect(estadoSeleccionEncabezado(filas, new Set())).toBe('ninguno');
  });

  it('todas las filas visibles seleccionadas', () => {
    const filas = [fila({ id: 'a' }), fila({ id: 'b' })];
    expect(estadoSeleccionEncabezado(filas, new Set(['a', 'b']))).toBe('todos');
  });

  it('algunas seleccionadas', () => {
    const filas = [fila({ id: 'a' }), fila({ id: 'b' })];
    expect(estadoSeleccionEncabezado(filas, new Set(['a']))).toBe('algunos');
  });

  it('ids seleccionados que no están en las filas visibles (filtradas) no cuentan', () => {
    const filas = [fila({ id: 'a' })];
    expect(estadoSeleccionEncabezado(filas, new Set(['a', 'z']))).toBe('todos');
  });
});

describe('admin-catalogo — redondearPrecio', () => {
  it('sube un porcentaje positivo', () => {
    expect(redondearPrecio(1000, 10)).toBe(1100);
  });

  it('baja un porcentaje negativo', () => {
    expect(redondearPrecio(1000, -10)).toBe(900);
  });

  it('redondea al entero más cercano', () => {
    expect(redondearPrecio(999, 10)).toBe(1099); // 1098.9 -> 1099
  });

  it('nunca deja el precio en 0 o negativo, aunque el porcentaje sea muy negativo', () => {
    expect(redondearPrecio(1000, -100)).toBe(1);
    expect(redondearPrecio(1000, -500)).toBe(1);
  });

  it('0% no cambia el precio', () => {
    expect(redondearPrecio(1000, 0)).toBe(1000);
  });
});

describe('admin-catalogo — codigosBorrablesLote', () => {
  it('código exclusivo del lote es borrable', () => {
    const a = producto({ id: 'a', codigo: 'UNICO' });
    const b = producto({ id: 'b', codigo: 'OTRO' });
    expect(codigosBorrablesLote([a], [a, b])).toEqual(['UNICO']);
  });

  it('código compartido con algo FUERA del lote no es borrable', () => {
    const a = producto({ id: 'a', codigo: 'COMPARTIDO' });
    const b = producto({ id: 'b', codigo: 'COMPARTIDO' });
    expect(codigosBorrablesLote([a], [a, b])).toEqual([]);
  });

  it('código compartido SÓLO entre dos productos del mismo lote sí es borrable (el bug que esto evita)', () => {
    const a = producto({ id: 'a', codigo: 'COMPARTIDO' });
    const b = producto({ id: 'b', codigo: 'COMPARTIDO' });
    expect(codigosBorrablesLote([a, b], [a, b])).toEqual(['COMPARTIDO']);
  });

  it('variantes: cada código del lote se chequea por separado', () => {
    const a = producto({ id: 'a', variantes: [{ talle: 'Chico', codigo: 'X', activo: true }, { talle: 'Grande', codigo: 'Y', activo: true }] });
    const b = producto({ id: 'b', codigo: 'Y' });
    expect(codigosBorrablesLote([a], [a, b])).toEqual(['X']);
  });
});

describe('admin-catalogo — nuevaVarianteVacia', () => {
  it('arranca activa ("a la venta"), sin talle/tipo/código', () => {
    expect(nuevaVarianteVacia()).toEqual({ talle: '', tipo: '', codigo: '', activo: true });
  });
});

describe('admin-catalogo — validarFilaVariante', () => {
  it('código vacío es inválido (a diferencia del código simple)', () => {
    expect(validarFilaVariante({ codigo: '' })).not.toBeNull();
    expect(validarFilaVariante({ codigo: '   ' })).not.toBeNull();
  });

  it('código con contenido es válido', () => {
    expect(validarFilaVariante({ codigo: '04375' })).toBeNull();
  });

  it('más de 16 caracteres es inválido', () => {
    expect(validarFilaVariante({ codigo: '12345678901234567' })).not.toBeNull();
  });
});

describe('admin-catalogo — primerErrorDeVariantes', () => {
  it('sin filas, null', () => {
    expect(primerErrorDeVariantes([])).toBeNull();
  });

  it('todas válidas, null', () => {
    expect(primerErrorDeVariantes([{ codigo: 'A' }, { codigo: 'B' }])).toBeNull();
  });

  it('devuelve el error de la primera fila inválida que encuentra', () => {
    expect(primerErrorDeVariantes([{ codigo: 'A' }, { codigo: '' }])).not.toBeNull();
  });
});

describe('admin-catalogo — normalizarVariantes', () => {
  it('recorta espacios de talle/tipo/código', () => {
    const out = normalizarVariantes([{ talle: '  Chico  ', tipo: '  ', codigo: ' 001 ', activo: true }]);
    expect(out).toEqual([{ talle: 'Chico', tipo: undefined, codigo: '001', imagen: undefined, activo: true }]);
  });

  it('talle/tipo vacíos quedan undefined, no string vacío', () => {
    const out = normalizarVariantes([{ talle: '', tipo: '', codigo: 'X', activo: false }]);
    expect(out[0].talle).toBeUndefined();
    expect(out[0].tipo).toBeUndefined();
  });

  it('conserva imagen y activo tal cual', () => {
    const out = normalizarVariantes([{ codigo: 'X', imagen: 'https://cdn/x.webp', activo: false }]);
    expect(out[0]).toEqual({ talle: undefined, tipo: undefined, codigo: 'X', imagen: 'https://cdn/x.webp', activo: false });
  });
});
