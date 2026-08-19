/* admin-catalogo.js — pestaña "Sin activar" (espejo de Búho): armado puro de
 * la fila lista para activar un código (catalogo_productos + catalogo_precios).
 * El fetch/activación real contra Supabase se prueba por e2e (Task 14).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadScript } from '../helpers/loadScript.js';

// Mismo motivo que admin-catalogo-lista.test.js (Task 11): admin-catalogo.js
// corre chequear() al cargar y pisa .hidden de #adm-gate/#adm-panel — hace
// falta este DOM mínimo montado ANTES de loadScript().
let armarFilaActivacion;
beforeAll(() => {
  document.body.innerHTML =
    '<div id="adm-gate"><button id="adm-login-btn"></button></div>' +
    '<div id="adm-panel" hidden>' +
    '  <div class="adm-tabs"><button id="adm-tab-publicado" class="adm-tab is-active"></button><button id="adm-tab-espejo" class="adm-tab"></button></div>' +
    '  <div id="adm-panel-publicado"></div>' +
    '  <div id="adm-panel-espejo" hidden></div>' +
    '</div>';
  loadScript('assets/admin-catalogo.js');
  ({ armarFilaActivacion } = window.__MM_ADMIN_CATALOGO_TEST__);
});

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
