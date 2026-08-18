/* admin-catalogo.js — pestaña "Publicado": unificación de catalogo_productos
 * (productos DB-nativos) y catalogo_tarjetas (tarjetas escritas a mano en
 * el HTML con overrides) en una sola lista, más el filtro/orden que usa la
 * tabla del panel. Funciones puras, sin DOM — el fetch real y el pintado
 * se prueban por e2e (tests/e2e/admin-catalogo.spec.js).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadScript } from '../helpers/loadScript.js';

// admin-catalogo.js corre chequear() automáticamente al cargar (misma
// lógica que Task 10), y eso pisa .hidden de #adm-gate/#adm-panel — sin
// este DOM mínimo montado ANTES de loadScript(), el load tira excepción
// contra elementos null. window.MMCuenta queda sin definir a propósito:
// chequear() cae en mostrarGate() (rama segura, no hace ninguna llamada de
// red) y deja el resto del módulo (unificarLista/filtrarYOrdenar/etc.,
// expuestos en window.__MM_ADMIN_CATALOGO_TEST__) disponible para probar.
let unificarLista, filtrarYOrdenar, agruparPorOrigen;
beforeAll(() => {
  document.body.innerHTML =
    '<div id="adm-gate"><button id="adm-login-btn"></button></div>' +
    '<div id="adm-panel" hidden>' +
    '  <div class="adm-tabs"><button id="adm-tab-publicado" class="adm-tab is-active"></button><button id="adm-tab-espejo" class="adm-tab"></button></div>' +
    '  <div id="adm-panel-publicado"></div>' +
    '  <div id="adm-panel-espejo" hidden></div>' +
    '</div>';
  loadScript('assets/admin-catalogo.js');
  ({ unificarLista, filtrarYOrdenar, agruparPorOrigen } = window.__MM_ADMIN_CATALOGO_TEST__);
});

describe('unificarLista()', () => {
  it('un producto de catalogo_productos entra con origen "producto" y su precio/stock resuelto por código', () => {
    const productos = [{ id: 'p1', pagina: 'disfraces-v2.html', subcategoria_id: null, titulo: 'Capa roja', codigo: '04375', publicado: true, fotos: [{ src: 'x.webp' }] }];
    const precios = [{ codigo: '04375', precio: 5000, sin_stock: false, stock: 12 }];

    const lista = unificarLista(productos, [], precios);

    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ origen: 'producto', id: 'p1', titulo: 'Capa roja', precio: 5000, stock: 12, sinStock: false, publicadoOOculta: true });
  });

  it('una tarjeta de catalogo_tarjetas entra con origen "tarjeta", identificada por pagina~slug', () => {
    const tarjetas = [{ pagina: 'combos-v2.html', slug: 'combo-fiesta', oculta: false, sin_stock: null, precio_fijo: 15000, titulo_ref: 'Combo fiesta' }];

    const lista = unificarLista([], tarjetas, []);

    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ origen: 'tarjeta', id: 'combos-v2.html~combo-fiesta', titulo: 'Combo fiesta', precio: 15000, publicadoOOculta: true });
  });

  it('tarjeta oculta: publicadoOOculta refleja "oculta" invertido (false = no visible)', () => {
    const tarjetas = [{ pagina: 'combos-v2.html', slug: 'x', oculta: true, titulo_ref: 'X' }];
    const lista = unificarLista([], tarjetas, []);
    expect(lista[0].publicadoOOculta).toBe(false);
  });
});

describe('filtrarYOrdenar()', () => {
  const lista = [
    { id: 'a', origen: 'producto', titulo: 'Zapallo', codigo: '111', mundo: 'decoracion-v2.html', precio: 3000, publicadoOOculta: true },
    { id: 'b', origen: 'producto', titulo: 'Antifaz', codigo: '222', mundo: 'disfraces-v2.html', precio: 1000, publicadoOOculta: true },
    { id: 'c', origen: 'tarjeta', titulo: 'Combo XL', codigo: '333', mundo: 'combos-v2.html', precio: 9000, publicadoOOculta: false }
  ];

  it('busca por título sin distinguir mayúsculas/acentos', () => {
    const r = filtrarYOrdenar(lista, { busqueda: 'antifaz' });
    expect(r.map((x) => x.id)).toEqual(['b']);
  });

  it('busca por código exacto', () => {
    const r = filtrarYOrdenar(lista, { busqueda: '222' });
    expect(r.map((x) => x.id)).toEqual(['b']);
  });

  it('filtra por mundo', () => {
    const r = filtrarYOrdenar(lista, { mundo: 'disfraces-v2.html' });
    expect(r.map((x) => x.id)).toEqual(['b']);
  });

  it('filtra por estado "oculto"', () => {
    const r = filtrarYOrdenar(lista, { estado: 'oculto' });
    expect(r.map((x) => x.id)).toEqual(['c']);
  });

  it('ordena por precio ascendente/descendente', () => {
    expect(filtrarYOrdenar(lista, { sortCol: 'precio', sortDir: 'asc' }).map((x) => x.id)).toEqual(['b', 'a', 'c']);
    expect(filtrarYOrdenar(lista, { sortCol: 'precio', sortDir: 'desc' }).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
});
