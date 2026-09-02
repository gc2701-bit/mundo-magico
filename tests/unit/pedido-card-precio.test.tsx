/* lib/pedidos-admin.ts — resolución de precio/stock en vivo por ítem de un
 * pedido (Sprint C del dashboard admin, ver SPEC-dashboard-admin.md). El
 * pedido nunca guardó precio: se resuelve contra catalogo_precios_admin()
 * (misma fuente que actualiza el worker de Búho cada ~15 min), nunca un
 * snapshot. Mismo criterio que resumen() de lib/carrito.ts: subtotal +
 * cuántos ítems faltan, nunca un "Total" que sugiera estar completo si hay
 * huecos.
 */
import { describe, it, expect } from 'vitest';
import {
  codigosDelPedido,
  mapaPreciosPedido,
  resumenPrecioPedido,
  precioItemPedido,
  type ItemPedido,
} from '../../lib/pedidos-admin';

describe('codigosDelPedido', () => {
  it('junta los códigos únicos, ignorando ítems sin código', () => {
    const items: ItemPedido[] = [
      { t: 'Globo', q: 2, c: '111' },
      { t: 'Globo', q: 1, c: '111' },
      { t: 'Sombrero', q: 1, c: '222' },
      { t: 'Sin código (HTML legacy)', q: 1 },
    ];
    expect(codigosDelPedido(items).sort()).toEqual(['111', '222']);
  });
});

describe('resumenPrecioPedido / precioItemPedido', () => {
  const mapa = mapaPreciosPedido([
    { codigo: '111', precio: 1000, stock: 5 },
    { codigo: '222', precio: 500, stock: 0 },
  ]);

  it('todos los ítems con precio conocido: total completo', () => {
    const items: ItemPedido[] = [{ t: 'Globo', q: 2, c: '111' }, { t: 'Sombrero', q: 1, c: '222' }];
    const r = resumenPrecioPedido(items, mapa);
    expect(r).toEqual({ suma: 2500, conPrecio: 2, sinPrecio: 0, completo: true });
    expect(precioItemPedido(items[0], mapa)).toBe(1000);
  });

  it('mixto (un código no vino en la respuesta): subtotal incompleto', () => {
    const items: ItemPedido[] = [{ t: 'Globo', q: 2, c: '111' }, { t: 'Desconocido', q: 1, c: '999' }];
    const r = resumenPrecioPedido(items, mapa);
    expect(r).toEqual({ suma: 2000, conPrecio: 1, sinPrecio: 1, completo: false });
    expect(precioItemPedido(items[1], mapa)).toBeNull();
  });

  it('ningún ítem con código (o mapa vacío/null): sin precios disponibles, no rompe', () => {
    const items: ItemPedido[] = [{ t: 'Sin código', q: 1 }];
    expect(resumenPrecioPedido(items, mapa)).toEqual({ suma: 0, conPrecio: 0, sinPrecio: 1, completo: false });
    expect(resumenPrecioPedido(items, null)).toEqual({ suma: 0, conPrecio: 0, sinPrecio: 1, completo: false });
    expect(resumenPrecioPedido([], mapa)).toEqual({ suma: 0, conPrecio: 0, sinPrecio: 0, completo: false });
  });
});
