/* admin-catalogo.js — gate de es_admin() + arranque del panel. Mismo
 * criterio que tests/unit/admin-gate.test.js del editor viejo: la barrera
 * real es RLS, esto sólo prueba el comportamiento de UI (mostrar el gate
 * de login vs. el panel).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from '../helpers/loadScript.js';

function montarDOM() {
  document.body.innerHTML =
    '<div id="adm-gate" class="adm-gate"><button id="adm-login-btn"></button></div>' +
    '<div id="adm-panel" class="adm-panel" hidden>' +
    '  <div class="adm-tabs"><button id="adm-tab-publicado" class="adm-tab is-active"></button><button id="adm-tab-espejo" class="adm-tab"></button></div>' +
    '  <div id="adm-panel-publicado" class="adm-tab-panel"></div>' +
    '  <div id="adm-panel-espejo" class="adm-tab-panel" hidden></div>' +
    '</div>';
}

function mockMMCuenta({ sesionActiva, esAdminRpc }) {
  const rpc = vi.fn(() => Promise.resolve(esAdminRpc));
  // Builder mínimo pero completo: las dos pestañas encadenan
  // .select()/.eq()/.order()/.or() en distinto orden, y este test no mira
  // los datos — sólo que el gate abra o no el panel.
  const from = vi.fn(() => {
    const chain = Promise.resolve({ data: [], error: null });
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.order = () => chain;
    chain.or = () => chain;
    return chain;
  });
  window.MMCuenta = { sesionActiva: () => sesionActiva, cliente: () => ({ rpc, from }) };
  return { rpc, from };
}

beforeEach(() => {
  montarDOM();
  delete window.MMCuenta;
});

describe('admin-catalogo.js — gate de es_admin()', () => {
  it('sin sesión: el gate queda visible, el panel oculto', () => {
    mockMMCuenta({ sesionActiva: false, esAdminRpc: { data: true, error: null } });
    loadScript('assets/admin-catalogo.js');

    expect(document.getElementById('adm-gate').hidden).toBe(false);
    expect(document.getElementById('adm-panel').hidden).toBe(true);
  });

  it('sesión activa pero NO admin: el gate queda visible (mensaje de "no autorizado" implícito en que el panel no se muestra)', async () => {
    mockMMCuenta({ sesionActiva: true, esAdminRpc: { data: false, error: null } });
    loadScript('assets/admin-catalogo.js');
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById('adm-panel').hidden).toBe(true);
  });

  it('sesión activa y admin: se oculta el gate y se muestra el panel, con "Publicado" activa por default', async () => {
    mockMMCuenta({ sesionActiva: true, esAdminRpc: { data: true, error: null } });
    loadScript('assets/admin-catalogo.js');
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById('adm-gate').hidden).toBe(true);
    expect(document.getElementById('adm-panel').hidden).toBe(false);
    expect(document.getElementById('adm-panel-publicado').hidden).toBe(false);
    expect(document.getElementById('adm-panel-espejo').hidden).toBe(true);
  });

  it('click en la pestaña "Sin activar": alterna qué panel está visible y la clase is-active', async () => {
    mockMMCuenta({ sesionActiva: true, esAdminRpc: { data: true, error: null } });
    loadScript('assets/admin-catalogo.js');
    await new Promise((r) => setTimeout(r, 0));

    document.getElementById('adm-tab-espejo').click();

    expect(document.getElementById('adm-panel-publicado').hidden).toBe(true);
    expect(document.getElementById('adm-panel-espejo').hidden).toBe(false);
    expect(document.getElementById('adm-tab-espejo').classList.contains('is-active')).toBe(true);
    expect(document.getElementById('adm-tab-publicado').classList.contains('is-active')).toBe(false);
  });
});
