/* lib/pedido.ts — visor de pedido compartido por link (Sprint 5, Task 5.2),
 * portado de pedido.html. */
import { describe, it, expect } from 'vitest';
import { base64url } from '../../lib/carrito';
import { decodificarPedido, fotoSegura, resumenPedido, lineasEntrega, lineasParaConfirmar } from '../../lib/pedido';

function hashDe(payload) {
  return '#' + base64url(JSON.stringify(payload));
}

describe('decodificarPedido', () => {
  it('formato viejo (array pelado): items sin entrega', () => {
    const r = decodificarPedido(hashDe([{ t: 'Globo', q: 2 }]));
    expect(r).toEqual({ items: [{ t: 'Globo', q: 2 }], entrega: null });
  });

  it('formato nuevo ({i, e}): items + entrega', () => {
    const r = decodificarPedido(hashDe({ i: [{ t: 'Globo', q: 2 }], e: { nombre: 'Ana' } }));
    expect(r).toEqual({ items: [{ t: 'Globo', q: 2 }], entrega: { nombre: 'Ana' } });
  });

  it('hash vacío o corrupto: null', () => {
    expect(decodificarPedido('#')).toBeNull();
    expect(decodificarPedido('#no-es-base64-valido!!!')).toBeNull();
  });

  it('payload sin items (ej. un objeto cualquiera): null', () => {
    expect(decodificarPedido(hashDe({ e: { nombre: 'Ana' } }))).toBeNull();
    expect(decodificarPedido(hashDe([]))).toBeNull();
  });
});

describe('fotoSegura', () => {
  it('acepta rutas relativas del catálogo', () => {
    expect(fotoSegura('productos/globos/foto.jpg')).toBe('productos/globos/foto.jpg');
  });
  it('rechaza URLs absolutas, protocol-relative, data:/javascript: y ..', () => {
    expect(fotoSegura('http://otro-sitio.com/x.jpg')).toBe('');
    expect(fotoSegura('//otro-sitio.com/x.jpg')).toBe('');
    expect(fotoSegura('javascript:alert(1)')).toBe('');
    expect(fotoSegura('data:image/png;base64,xxx')).toBe('');
    expect(fotoSegura('../../etc/passwd')).toBe('');
  });
  it('valores no-string devuelven vacío', () => {
    expect(fotoSegura(null)).toBe('');
    expect(fotoSegura(undefined)).toBe('');
    expect(fotoSegura(42)).toBe('');
  });
});

describe('resumenPedido', () => {
  it('cuenta unidades, renglones y sin código', () => {
    const r = resumenPedido([{ t: 'A', q: 2, c: '1' }, { t: 'B', q: 1 }, { t: 'C', q: 0 }]);
    // q=0 se trata como 1 (mismo guard que pedido.html)
    expect(r).toEqual({ unidades: 4, renglones: 3, sinCodigo: 2 });
  });
});

describe('lineasEntrega', () => {
  it('retiro: línea de sucursal', () => {
    const L = lineasEntrega({ metodoEntrega: 'retiro', sucursalNombre: 'Junín 351' });
    expect(L).toContain('Retiro en Junín 351');
  });

  it('retiro sin sucursal: "el local"', () => {
    expect(lineasEntrega({ metodoEntrega: 'retiro' })).toContain('Retiro en el local');
  });

  it('envío con reparto propio y sin fecha: aclara "entrega estimada"', () => {
    const L = lineasEntrega({ metodoEntrega: 'envio', zonaNombre: 'Yerba Buena', direccion: 'Calle 123', entregaPropia: true });
    expect(L).toContain('Envío a Yerba Buena — Calle 123');
    expect(L.some((l) => /Entrega estimada: 1 a 3 días hábiles/.test(l))).toBe(true);
  });

  it('envío sin reparto propio (entregaPropia:false) y sin fecha: el cliente coordina', () => {
    const L = lineasEntrega({ metodoEntrega: 'envio', entregaPropia: false });
    expect(L.some((l) => /lo coordina y paga el cliente/.test(l))).toBe(true);
  });

  it('link viejo sin entregaPropia (undefined): se asume true', () => {
    const L = lineasEntrega({ metodoEntrega: 'envio' });
    expect(L.some((l) => /Entrega estimada/.test(l))).toBe(true);
  });

  it('con fecha, no aclara "estimada" — usa la fecha real reformateada', () => {
    const L = lineasEntrega({ metodoEntrega: 'envio', fechaEntrega: '2026-01-05' });
    expect(L).toContain('Para cuándo: 05/01/2026');
    expect(L.some((l) => /Entrega estimada/.test(l))).toBe(false);
  });

  it('incluye entre calles, piso/depto, receptor y costo cuando vienen', () => {
    const L = lineasEntrega({
      metodoEntrega: 'envio', entreCalles: 'San Martín y Congreso', pisoDepto: '2do B',
      receptorNombre: 'Juan', receptorTelefono: '3811234567', costoEnvio: 2000,
    });
    expect(L).toContain('Entre calles: San Martín y Congreso');
    expect(L).toContain('Piso/depto: 2do B');
    expect(L).toContain('Lo recibe: Juan (3811234567)');
    expect(L).toContain('Costo de envío: $2000 (más el total de los productos)');
  });
});

describe('lineasParaConfirmar', () => {
  it('sin faltantes: dice que todos vinieron con código', () => {
    expect(lineasParaConfirmar(0)).toContain('Todos los productos vinieron con código de sistema.');
  });
  it('con faltantes: cuenta cuántos', () => {
    expect(lineasParaConfirmar(3)).toContain('3 producto(s) vinieron sin código: buscalos por nombre en el sistema.');
  });
});
