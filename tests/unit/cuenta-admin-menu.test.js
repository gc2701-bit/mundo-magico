/* cuenta.js — item de menú "Catálogo" solo para admins, en el desplegable
 * de cuenta (pintarPop()). Mismo criterio de gate que el resto del sitio
 * (es_admin() vía RPC, nunca confiar en esto como seguridad real — RLS lo
 * es). No hay test previo de pintarPop() en el repo: éste es el primero,
 * acotado a este único ítem nuevo.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from '../helpers/loadScript.js';

function mockSupabaseSesion({ esAdmin }) {
  const rpc = vi.fn(() => Promise.resolve({ data: esAdmin, error: null }));
  window.supabase = {
    createClient: () => ({
      auth: {
        onAuthStateChange: (cb) => { window.__onAuthChange = cb; return { data: { subscription: { unsubscribe() {} } } }; },
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1', email: 'a@a.com' } } } }),
        signOut: () => Promise.resolve({})
      },
      rpc
    })
  };
  window.MM_SUPABASE = { url: 'https://proyecto.supabase.co', anonKey: 'anon-key-publica' };
  return rpc;
}

beforeEach(() => {
  document.body.innerHTML = '<nav class="nav"><button class="nav-toggle"></button></nav>';
  delete window.supabase;
  delete window.MM_SUPABASE;
  delete window.MMCuenta;
});

describe('cuenta.js — item de menú "Catálogo" solo para admins', () => {
  it('cuenta admin: el desplegable de cuenta muestra el link a admin-catalogo.html', async () => {
    mockSupabaseSesion({ esAdmin: true });
    loadScript('assets/cuenta.js');
    await new Promise((r) => setTimeout(r, 0));

    document.querySelector('.cuenta-nav').click();
    await new Promise((r) => setTimeout(r, 0));

    const link = document.querySelector('.cuenta-pop-admin');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('admin-catalogo.html');
  });

  it('cuenta NO admin: el desplegable no muestra ningún link de admin', async () => {
    mockSupabaseSesion({ esAdmin: false });
    loadScript('assets/cuenta.js');
    await new Promise((r) => setTimeout(r, 0));

    document.querySelector('.cuenta-nav').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelector('.cuenta-pop-admin')).toBeNull();
  });
});
