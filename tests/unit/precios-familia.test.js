/* lib/precios-familia.ts — resolución de precio/stock para el catálogo
 * nuevo (Sprint 2, Task 2.3).
 */
import { describe, it, expect } from 'vitest';
import { resolverEstadoProducto, resolverOferta } from '../../lib/precios-familia.ts';

// El formateador de Intl.NumberFormat('es-AR', ...) usa un espacio
// irrompible ( ) entre "$" y el número — se arma acá el mismo string
// en vez de escribirlo a mano para no depender de qué caracter exacto usa
// esta versión de Node/ICU.
const fmtTest = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
function money(n) {
  return fmtTest.format(n);
}

describe('precios-familia — resolverEstadoProducto', () => {
  it('producto simple con precio conocido', () => {
    const r = resolverEstadoProducto({ codigo: '04375', talles: null }, { '04375': 1000 }, {}, {});
    expect(r).toEqual({ texto: money(1000), sinStock: false, pocasUnidades: false });
  });

  it('producto simple sin precio en la respuesta -> texto null (no inventa nada)', () => {
    const r = resolverEstadoProducto({ codigo: '99999', talles: null }, { '04375': 1000 }, {}, {});
    expect(r.texto).toBeNull();
  });

  it('sin código y sin talles -> texto null', () => {
    const r = resolverEstadoProducto({ codigo: null, talles: null }, {}, {}, {});
    expect(r.texto).toBeNull();
  });

  it('producto simple sin stock', () => {
    const r = resolverEstadoProducto({ codigo: '04375', talles: null }, { '04375': 1000 }, { '04375': true }, {});
    expect(r.sinStock).toBe(true);
  });

  it('producto simple con pocas unidades', () => {
    const r = resolverEstadoProducto({ codigo: '04375', talles: null }, { '04375': 1000 }, {}, { '04375': true });
    expect(r.pocasUnidades).toBe(true);
  });

  it('talles: usa el mínimo precio y antepone "Desde"', () => {
    const talles = [{ nombre: 'Chico', codigo: 'A' }, { nombre: 'Grande', codigo: 'B' }];
    const r = resolverEstadoProducto({ codigo: null, talles }, { A: 2000, B: 3500 }, {}, {});
    expect(r.texto).toBe('Desde ' + money(2000));
  });

  it('talles: un solo talle con precio conocido igual usa "Desde"', () => {
    const talles = [{ nombre: 'Chico', codigo: 'A' }, { nombre: 'Grande', codigo: 'B' }];
    const r = resolverEstadoProducto({ codigo: null, talles }, { A: 2000 }, {}, {});
    expect(r.texto).toBe('Desde ' + money(2000));
  });

  it('talles: sin stock sólo si TODAS las opciones están sin stock', () => {
    const talles = [{ nombre: 'Chico', codigo: 'A' }, { nombre: 'Grande', codigo: 'B' }];
    const r1 = resolverEstadoProducto({ codigo: null, talles }, { A: 2000, B: 3500 }, { A: true }, {});
    expect(r1.sinStock).toBe(false);
    const r2 = resolverEstadoProducto({ codigo: null, talles }, { A: 2000, B: 3500 }, { A: true, B: true }, {});
    expect(r2.sinStock).toBe(true);
  });
});

describe('precios-familia — resolverOferta', () => {
  it('precio de oferta menor al real: hay oferta, con los dos precios y el % calculado', () => {
    const r = resolverOferta(5600, 4500);
    expect(r).toEqual({ enOferta: true, precioAntes: money(5600), precioAhora: money(4500), porcentajeOff: 20 });
  });

  it('sin precio de oferta: no hay oferta, no inventa nada', () => {
    const r = resolverOferta(5600, null);
    expect(r).toEqual({ enOferta: false, precioAntes: null, precioAhora: null, porcentajeOff: null });
  });

  it('sin precio real todavía (no hidrató): no hay oferta, aunque venga precioOferta', () => {
    const r = resolverOferta(null, 4500);
    expect(r.enOferta).toBe(false);
  });

  it('precio de oferta igual o mayor al real: se ignora, nunca "oferta" que encarece', () => {
    expect(resolverOferta(4500, 4500).enOferta).toBe(false);
    expect(resolverOferta(4500, 5000).enOferta).toBe(false);
  });
});
