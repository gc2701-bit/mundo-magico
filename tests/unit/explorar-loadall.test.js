/* PROVE-IT: assets/explorar.js `loadAll()` (líneas ~191-211 al momento de
 * escribir esto).
 *
 * Hoy loadAll() SIEMPRE hace fetch()+DOMParser de las 7 páginas de
 * categoría completas para armar el feed de Explorar, y sólo usa el
 * snapshot `window.__EXPLORAR_DATA__` (assets/explorar-data.js) como
 * respaldo cuando ese fetch no trae nada (típicamente sólo bajo file://,
 * donde fetch() está bloqueado — ver el comentario del propio archivo).
 *
 * El cambio de performance pendiente es invertir esa prioridad: si ya hay
 * un feed JSON (`window.__EXPLORAR_DATA__`, el mismo snapshot, generado por
 * .claude/gen-explorar-data.js) usarlo directo, y sólo recurrir a
 * fetch+DOMParser de las páginas HTML si por algún motivo ese JSON no
 * está disponible.
 *
 * Este test HOY FALLA a propósito: arranca con un snapshot completo ya
 * disponible y comprueba que ni así se evita el fetch de las 7 páginas.
 * Cuando se invierta la prioridad en loadAll(), este mismo test debe pasar
 * sin tocarle una línea.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from '../helpers/loadScript.js';

const CAT_PAGES = [
  'globos-fiesta-v2.html', 'cumpleanos-v2.html', 'disfraces-v2.html',
  'reposteria-v2.html', 'decoracion-v2.html', 'combos-v2.html', 'especiales-v2.html'
];

function fixtureDom() {
  document.body.innerHTML = `
    <button id="chipsToggle"></button>
    <span id="chipsToggleLabel"></span>
    <div id="chipsScrim"></div>
    <div id="chipsPanel">
      <div id="chips"></div>
      <div id="tagChips"></div>
    </div>
    <div id="backdrop"></div>
    <div id="reelLoading"></div>
    <main id="reel"></main>
  `;
}

function snapshotCompleto() {
  const data = {};
  CAT_PAGES.forEach((pagina) => {
    data[pagina] = [{
      title: 'Producto de prueba en ' + pagina,
      images: [{ src: 'productos/foo.webp', cap: '', alt: 'Producto de prueba' }],
      specs: ['Alguna especificación'],
      price: '',
      wamsg: ''
    }];
  });
  return data;
}

beforeEach(() => {
  fixtureDom();
  window.__EXPLORAR_DATA__ = snapshotCompleto();
  delete window.MMCatalogo; // aplicarOcultos() hace cb() directo si no está
  window.matchMedia = window.matchMedia || (() => ({ matches: false }));
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      observe() {} unobserve() {} disconnect() {}
    };
  }
});

describe('explorar.js loadAll() — preferir el feed JSON sobre re-descargar las 7 páginas HTML', () => {
  it('con window.__EXPLORAR_DATA__ ya disponible, NO debería volver a pedir las páginas de categoría por fetch()', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve('<html></html>') }));
    global.fetch = fetchMock;
    window.fetch = fetchMock;

    loadScript('assets/explorar.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // loadAll()/aplicarOcultos() son asíncronos (Promise.all de los fetch +
    // el callback de MMCatalogo.cargar); un par de vueltas de microtask
    // alcanzan porque en este test MMCatalogo no está definido.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    // Este assert es el que hoy FALLA: loadAll() llama a fetch() para cada
    // una de las 7 páginas SIEMPRE, sin mirar primero si ya hay snapshot.
    expect(fetchMock).not.toHaveBeenCalled();

    // Y aun así el feed se pobló (desde el snapshot): la regresión a
    // arreglar es de performance, no de funcionalidad — el feed ya
    // funciona hoy, sólo que pagando 7 descargas de más.
    const reel = document.getElementById('reel');
    expect(reel.querySelectorAll('.slide').length).toBeGreaterThan(0);
  });
});
