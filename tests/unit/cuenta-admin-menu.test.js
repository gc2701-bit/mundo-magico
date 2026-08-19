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

  // Regresión: chequearEsAdmin() cachea el resultado por uid, así que en la
  // SEGUNDA apertura el callback corre SINCRÓNICO, adentro de la llamada. Con
  // el appendChild de "Cerrar sesión" abajo del chequeo, ese callback hacía
  // insertBefore(catalogo, salir) contra un `salir` que todavía no estaba en
  // el DOM → NotFoundError, pintarPop() abortaba y el menú quedaba sin el
  // link de admin Y sin "Cerrar sesión". El test viejo abría el menú una sola
  // vez (camino async, el que nunca estuvo roto) y no lo veía.
  it('cuenta admin: abrir el desplegable dos veces sigue mostrando "Catálogo" y "Cerrar sesión"', async () => {
    const rpc = mockSupabaseSesion({ esAdmin: true });
    const errores = [];
    const onError = (e) => { errores.push(e.error || e.message); };
    window.addEventListener('error', onError);

    loadScript('assets/cuenta.js');
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.querySelector('.cuenta-nav');
    btn.click();                                   // 1ª apertura: RPC async
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.cuenta-pop-admin')).not.toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);

    btn.click();                                   // cierra
    await new Promise((r) => setTimeout(r, 0));
    btn.click();                                   // 2ª apertura: cache → sync
    await new Promise((r) => setTimeout(r, 0));

    window.removeEventListener('error', onError);

    expect(errores).toEqual([]);
    // El cache tiene que haber evitado la segunda RPC — si no, este test no
    // estaría ejercitando el camino síncrono que rompía.
    expect(rpc).toHaveBeenCalledTimes(1);

    const pop = document.querySelector('.cuenta-pop');
    expect(pop.querySelector('.cuenta-pop-admin')).not.toBeNull();
    expect(pop.querySelector('.cuenta-pop-out')).not.toBeNull();
    expect(pop.querySelector('.cuenta-pop-out').textContent).toBe('Cerrar sesión');
    // Y en el orden de siempre: "Catálogo" arriba de "Cerrar sesión".
    const items = Array.from(pop.children).map((n) => n.className);
    expect(items.indexOf('cuenta-pop-item cuenta-pop-admin')).toBeLessThan(items.indexOf('cuenta-pop-out'));
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
