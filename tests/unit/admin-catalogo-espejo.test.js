/* admin-catalogo.js — pestaña "Sin activar" (espejo de Búho): armado puro de
 * la fila lista para activar un código (catalogo_productos + catalogo_precios).
 * El fetch/activación real contra Supabase se prueba por e2e (Task 14).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadScript } from '../helpers/loadScript.js';

// Mismo motivo que admin-catalogo-lista.test.js (Task 11): admin-catalogo.js
// corre chequear() al cargar y pisa .hidden de #adm-gate/#adm-panel — hace
// falta este DOM mínimo montado ANTES de loadScript().
let armarFilaActivacion, activarCodigo;
beforeAll(() => {
  document.body.innerHTML =
    '<div id="adm-gate"><button id="adm-login-btn"></button></div>' +
    '<div id="adm-panel" hidden>' +
    '  <div class="adm-tabs"><button id="adm-tab-publicado" class="adm-tab is-active"></button><button id="adm-tab-espejo" class="adm-tab"></button></div>' +
    '  <div id="adm-panel-publicado"></div>' +
    '  <div id="adm-panel-espejo" hidden></div>' +
    '</div>';
  loadScript('assets/admin-catalogo.js');
  ({ armarFilaActivacion, activarCodigo } = window.__MM_ADMIN_CATALOGO_TEST__);
});

// Cliente Supabase falso: sólo lo mínimo que activarCodigo() encadena
// (from().insert().select(), from().upsert(), from().update().eq()), cada
// uno resuelve con la respuesta {data, error} configurada por tabla, igual
// que supabase-js real (nunca rechaza la promesa por sí solo — por eso hay
// que chequear r.error a mano en cada paso, que es justo lo que este test
// verifica).
function fakeSb(respuestas) {
  return {
    from(tabla) {
      const r = respuestas[tabla] || { data: null, error: null };
      return {
        insert() { return { select: () => Promise.resolve(r) }; },
        upsert() { return Promise.resolve(r); },
        update() { return { eq: () => Promise.resolve(r) }; }
      };
    }
  };
}

describe('armarFilaActivacion()', () => {
  it('arma la fila de catalogo_productos y el precio/stock desde el código del espejo', () => {
    const codigoEspejo = { codigo: '58231', nombre: 'Sombrero de mago', familia: 'Disfraces', precio: 4500, stock: 20, es_combo: false };
    const r = armarFilaActivacion(codigoEspejo, { mundo: 'disfraces-v2.html', subcategoriaId: 'sub-1', fotos: [{ src: 'https://x/foto.webp', cap: '' }] });

    expect(r.producto).toMatchObject({
      pagina: 'disfraces-v2.html',
      subcategoria_id: 'sub-1',
      titulo: 'Sombrero de mago',
      slug: 'sombrero-de-mago',
      codigo: '58231',
      fotos: [{ src: 'https://x/foto.webp', cap: '' }],
      publicado: true
    });
    expect(r.precio).toMatchObject({ codigo: '58231', precio: 4500, stock: 20, sin_stock: false });
  });

  it('sin fotos: rechaza (no se puede activar sin al menos una foto)', () => {
    const codigoEspejo = { codigo: '1', nombre: 'X', precio: 100, stock: 1 };
    expect(() => armarFilaActivacion(codigoEspejo, { mundo: 'combos-v2.html', subcategoriaId: null, fotos: [] }))
      .toThrow(/foto/i);
  });

  it('sin mundo elegido: rechaza', () => {
    const codigoEspejo = { codigo: '1', nombre: 'X', precio: 100, stock: 1 };
    expect(() => armarFilaActivacion(codigoEspejo, { mundo: '', subcategoriaId: null, fotos: [{ src: 'x' }] }))
      .toThrow(/mundo/i);
  });
});

describe('activarCodigo()', () => {
  const codigoEspejo = { codigo: '58231', nombre: 'Sombrero de mago', precio: 4500, stock: 20 };
  const opts = { mundo: 'disfraces-v2.html', subcategoriaId: null, fotos: [{ src: 'https://x/foto.webp', cap: '' }] };

  it('las tres escrituras OK: resuelve', async () => {
    const sb = fakeSb({
      catalogo_productos: { data: [{ id: 'p1' }], error: null },
      catalogo_precios: { data: [{ codigo: '58231' }], error: null },
      catalogo_buho_espejo: { data: [{ codigo: '58231' }], error: null }
    });
    await expect(activarCodigo(sb, codigoEspejo, opts)).resolves.toBeTruthy();
  });

  // Regresión: supabase-js resuelve (no rechaza) incluso cuando el write
  // falla del lado de PostgREST — devuelve {data, error} en el mismo
  // objeto resuelto. Antes del fix, activarCodigo() devolvía ese objeto
  // directo en el tercer paso sin chequear .error, así que la promesa de
  // activarCodigo() terminaba resolviendo igual aunque el espejo nunca se
  // hubiera marcado publicado=true.
  it('falla el tercer write (marcar el espejo): la promesa rechaza, no resuelve en silencio', async () => {
    const errorEspejo = { message: 'no matching row' };
    const sb = fakeSb({
      catalogo_productos: { data: [{ id: 'p1' }], error: null },
      catalogo_precios: { data: [{ codigo: '58231' }], error: null },
      catalogo_buho_espejo: { data: null, error: errorEspejo }
    });
    await expect(activarCodigo(sb, codigoEspejo, opts)).rejects.toBe(errorEspejo);
  });

  it('falla el primer write (insert producto): la promesa rechaza sin llegar a los otros pasos', async () => {
    const errorProducto = { message: 'duplicate key' };
    const sb = fakeSb({ catalogo_productos: { data: null, error: errorProducto } });
    await expect(activarCodigo(sb, codigoEspejo, opts)).rejects.toBe(errorProducto);
  });
});
