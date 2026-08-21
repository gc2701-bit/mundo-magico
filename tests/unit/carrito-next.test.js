/* lib/carrito.ts — carrito de pedidos → WhatsApp (Sprint 5, Task 5.2),
 * portado de public/assets/carrito.js. Lógica pura: item CRUD, resumen de
 * precios, armado del mensaje y del link de "ver pedido completo".
 */
import { describe, it, expect, vi } from 'vitest';
import {
  claveItem, cargarCarrito, guardarCarrito, itemPorClave, cantidadDe, cantidadTotalDe,
  ponerCantidad, quitarItem, precioUnidad, resumen, base64url, base64urlDecode,
  itemsParaLink, urlPedido, waLink, construirMensaje, guardarPedido, formatoPlata, MAX_ITEMS,
} from '../../lib/carrito';

function fakeStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v) };
}

const globo = { title: 'Globo estándar 12', code: '01848', variant: 'Blanco', img: 'g.jpg' };

describe('claveItem', () => {
  it('combina código + título + variante', () => {
    expect(claveItem(globo)).toBe('01848::Globo estándar 12::Blanco');
  });
  it('sin variante, el separador queda vacío', () => {
    expect(claveItem({ code: 'x', title: 'Y', variant: '' })).toBe('x::Y::');
  });
});

describe('cargarCarrito / guardarCarrito', () => {
  it('sin nada guardado, devuelve []', () => {
    expect(cargarCarrito(fakeStorage())).toEqual([]);
  });
  it('JSON corrupto no rompe', () => {
    const s = fakeStorage();
    s.setItem('mm_carrito_v2', '{no es json');
    expect(cargarCarrito(s)).toEqual([]);
  });
  it('lee lo guardado', () => {
    const s = fakeStorage();
    guardarCarrito([{ ...globo, qty: 2 }], s);
    expect(cargarCarrito(s)).toEqual([{ ...globo, qty: 2 }]);
  });
});

describe('ponerCantidad', () => {
  it('agrega un item nuevo', () => {
    const r = ponerCantidad([], globo, 1);
    expect(r.ok).toBe(true);
    expect(r.items).toEqual([{ ...globo, qty: 1 }]);
  });

  it('actualiza la cantidad de un item existente sin duplicarlo', () => {
    const items = [{ ...globo, qty: 1 }];
    const r = ponerCantidad(items, globo, 3);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].qty).toBe(3);
  });

  it('n<=0 saca el item', () => {
    const items = [{ ...globo, qty: 1 }];
    const r = ponerCantidad(items, globo, 0);
    expect(r.items).toEqual([]);
  });

  it('n<=0 sobre algo que no está: no rompe, no hace nada', () => {
    const r = ponerCantidad([], globo, 0);
    expect(r.items).toEqual([]);
  });

  it('respeta MAX_ITEMS: no agrega un renglón nuevo #41, pero sí deja editar los 40 que ya están', () => {
    const items = Array.from({ length: MAX_ITEMS }, (_, i) => ({ title: 'P' + i, code: 'c' + i, variant: '', img: '', qty: 1 }));
    const r = ponerCantidad(items, { title: 'Nuevo', code: 'cX', variant: '' }, 1);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('max_items');
    expect(r.items).toBe(items); // sin cambios

    const r2 = ponerCantidad(items, { title: 'P0', code: 'c0', variant: '' }, 5);
    expect(r2.ok).toBe(true);
    expect(r2.items[0].qty).toBe(5);
  });

  it('no muta el array original', () => {
    const items = [{ ...globo, qty: 1 }];
    ponerCantidad(items, globo, 5);
    expect(items[0].qty).toBe(1);
  });
});

describe('cantidadDe / cantidadTotalDe / itemPorClave / quitarItem', () => {
  const items = [
    { title: 'Globo', code: '01848', variant: 'Blanco', img: '', qty: 3 },
    { title: 'Globo', code: '01862', variant: 'Celeste', img: '', qty: 2 },
  ];

  it('cantidadDe lee la cantidad de una variante puntual', () => {
    expect(cantidadDe(items, { title: 'Globo', code: '01848', variant: 'Blanco' })).toBe(3);
    expect(cantidadDe(items, { title: 'Globo', code: '99999', variant: 'Rojo' })).toBe(0);
  });

  it('cantidadTotalDe suma todas las variantes del mismo título', () => {
    expect(cantidadTotalDe(items, 'Globo')).toBe(5);
  });

  it('itemPorClave encuentra por clave exacta', () => {
    expect(itemPorClave(items, claveItem(items[0]))?.variant).toBe('Blanco');
    expect(itemPorClave(items, 'no-existe')).toBeNull();
  });

  it('quitarItem saca sólo el renglón de esa clave', () => {
    const r = quitarItem(items, claveItem(items[0]));
    expect(r).toHaveLength(1);
    expect(r[0].variant).toBe('Celeste');
  });
});

describe('precioUnidad / resumen', () => {
  const items = [
    { title: 'A', code: 'a1', variant: '', img: '', qty: 2 },
    { title: 'B', code: '', variant: '', img: '', qty: 1 },
  ];
  const precios = { a1: 1000 };

  it('precioUnidad: 0 si no hay precios o no hay código', () => {
    expect(precioUnidad(items[0], precios)).toBe(1000);
    expect(precioUnidad(items[1], precios)).toBe(0);
    expect(precioUnidad(items[0], null)).toBe(0);
  });

  it('resumen: subtotal + cuenta de renglones sin precio', () => {
    const r = resumen(items, precios);
    expect(r).toEqual({ suma: 2000, conPrecio: 1, sinPrecio: 1, hayPrecios: true, completo: false });
  });

  it('resumen: completo=true cuando todos los renglones tienen precio', () => {
    const r = resumen([items[0]], precios);
    expect(r.completo).toBe(true);
  });

  it('resumen: sin módulo de precios, hayPrecios=false', () => {
    expect(resumen(items, null).hayPrecios).toBe(false);
  });
});

describe('base64url / base64urlDecode', () => {
  it('un objeto sobrevive al viaje de ida y vuelta', () => {
    const payload = { i: [{ t: 'Globo', q: 2 }], e: { nombre: 'Ana' } };
    const enc = base64url(JSON.stringify(payload));
    expect(enc).not.toMatch(/[+/=]/); // url-safe
    expect(base64urlDecode(enc)).toEqual(payload);
  });

  it('acentos y ñ sobreviven (unescape/encodeURIComponent)', () => {
    const enc = base64url(JSON.stringify({ t: 'Anteojos de novia — año nuevo, señorita' }));
    expect(base64urlDecode(enc)).toEqual({ t: 'Anteojos de novia — año nuevo, señorita' });
  });
});

describe('itemsParaLink / urlPedido', () => {
  const items = [{ title: 'Globo', code: '01848', variant: 'Blanco', img: 'g.jpg', qty: 2 }];

  it('itemsParaLink manda sólo los campos mínimos, omitiendo los vacíos', () => {
    expect(itemsParaLink(items)).toEqual([{ t: 'Globo', q: 2, v: 'Blanco', c: '01848', i: 'g.jpg' }]);
    expect(itemsParaLink([{ title: 'X', code: '', variant: '', img: '', qty: 1 }])).toEqual([{ t: 'X', q: 1 }]);
  });

  it('urlPedido sin entrega: payload es la lista pelada (compatibilidad con links viejos)', () => {
    const url = urlPedido({ items, baseUrl: 'https://mundomagico.com/' });
    expect(url).toMatch(/^https:\/\/mundomagico\.com\/pedido#/);
    const hash = url.split('#')[1];
    expect(base64urlDecode(hash)).toEqual(itemsParaLink(items));
  });

  it('urlPedido con entrega: payload es {i, e}', () => {
    const url = urlPedido({ items, entrega: { nombre: 'Ana' }, baseUrl: 'https://mundomagico.com' });
    const hash = url.split('#')[1];
    expect(base64urlDecode(hash)).toEqual({ i: itemsParaLink(items), e: { nombre: 'Ana' } });
  });

  it('vistaCliente agrega ?vista=cliente antes del hash', () => {
    const url = urlPedido({ items, vistaCliente: true, baseUrl: 'https://mundomagico.com/' });
    expect(url).toContain('/pedido?vista=cliente#');
  });
});

describe('waLink', () => {
  it('arma el link de wa.me con el texto codificado', () => {
    const link = waLink('hola *mundo*');
    expect(link).toBe('https://wa.me/5493813006343?text=' + encodeURIComponent('hola *mundo*'));
  });
  it('acepta un número distinto', () => {
    expect(waLink('hola', '5491111111111')).toMatch(/^https:\/\/wa\.me\/5491111111111\?/);
  });
});

describe('construirMensaje', () => {
  const items = [
    { title: 'Globo', code: '01848', variant: 'Blanco', img: '', qty: 2 },
    { title: 'Sin código', code: '', variant: '', img: '', qty: 1 },
  ];
  const precios = { '01848': 1000 };

  it('arma el mensaje con renglones, subtotal, nombre, entrega y nota', () => {
    const msg = construirMensaje({
      items, precios, nombre: 'Ana', entregaLineas: ['*Entrega:* Retiro en el local'], nota: 'Sin globos negros',
    });
    expect(msg).toContain('*Pedido desde la web* — Mundo Mágico');
    expect(msg).toContain(`• 2x [01848] Globo — Blanco — ${formatoPlata(2000)}`);
    expect(msg).toContain('*Subtotal:*'); // hay un renglón sin precio
    expect(msg).toContain('(1 sin precio)');
    expect(msg).toContain('*Nombre:* Ana');
    expect(msg).toContain('*Entrega:* Retiro en el local');
    expect(msg).toContain('*Comentario:* Sin globos negros');
    expect(msg).toContain('Espero confirmación de disponibilidad y total.');
  });

  it('con link, agrega la línea "Ver el pedido con fotos"', () => {
    const msg = construirMensaje({ items: [items[0]], precios, entregaLineas: [], link: 'https://x.com/pedido#abc' });
    expect(msg).toContain('Ver el pedido con fotos: https://x.com/pedido#abc');
  });

  it('sin ningún renglón con precio, no muestra subtotal/total', () => {
    const msg = construirMensaje({ items: [items[1]], precios, entregaLineas: [] });
    expect(msg).not.toContain('*Subtotal:*');
    expect(msg).not.toContain('*Total:*');
  });
});

describe('guardarPedido', () => {
  it('inserta la fila y devuelve true si no hay error', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const sb = { from: () => ({ insert }) };
    const ok = await guardarPedido(sb, { user_id: 'u1', items: [], nombre: 'Ana', nota: '', metodo_entrega: 'retiro', direccion: '', zona: '' });
    expect(ok).toBe(true);
    expect(insert).toHaveBeenCalled();
  });

  it('si falla, devuelve false sin lanzar (no bloquea el envío por WhatsApp)', async () => {
    const sb = { from: () => ({ insert: () => Promise.resolve({ error: new Error('columnas nuevas no existen') }) }) };
    const ok = await guardarPedido(sb, { user_id: 'u1', items: [], nombre: '', nota: '', metodo_entrega: 'retiro', direccion: '', zona: '' });
    expect(ok).toBe(false);
  });

  it('si tira una excepción, también devuelve false', async () => {
    const sb = { from: () => { throw new Error('boom'); } };
    const ok = await guardarPedido(sb, { user_id: 'u1', items: [], nombre: '', nota: '', metodo_entrega: 'retiro', direccion: '', zona: '' });
    expect(ok).toBe(false);
  });
});
