/* assets/cuenta.js expone window.MMCuenta.validarPass — la ÚNICA fuente de
 * verdad de la regla de contraseña (alta, cambio de contraseña y
 * recuperación la comparten, ver comentario en cuenta.js). Se prueba
 * directamente esa función pública en vez de simular todo el flujo de
 * signup/login, que además pega contra un `sb` fake.
 *
 * cuenta.js no hace nada (`window.MMCuenta` queda sin definir) si
 * `window.supabase`/`window.MM_SUPABASE` no existen — por eso el mock de acá
 * abajo es el mínimo indispensable para que el módulo pase esa guarda y
 * llegue a exponer su API pública.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from '../helpers/loadScript.js';

function mockSupabaseSdk() {
  window.supabase = {
    createClient: () => ({
      auth: {
        onAuthStateChange: () => {},
        getSession: () => Promise.resolve({ data: { session: null } }),
        signInWithPassword: () => Promise.resolve({ data: {}, error: null }),
        signUp: () => Promise.resolve({ data: {}, error: null }),
        updateUser: () => Promise.resolve({ data: {}, error: null }),
        resetPasswordForEmail: () => Promise.resolve({ data: {}, error: null }),
        signOut: () => Promise.resolve({ error: null })
      },
      rpc: () => Promise.resolve({ data: null, error: null }),
      from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) })
    })
  };
  window.MM_SUPABASE = { url: 'https://proyecto.supabase.co', anonKey: 'anon-key-publica' };
}

beforeEach(() => {
  document.body.innerHTML = '';
  delete window.supabase;
  delete window.MM_SUPABASE;
  delete window.MMCuenta;
});

describe('MMCuenta.validarPass — regla de contraseña compartida (alta/cambio/recuperación)', () => {
  it('no define window.MMCuenta si window.supabase no está disponible (nunca rompe el resto del sitio)', () => {
    loadScript('assets/cuenta.js');
    expect(window.MMCuenta).toBeUndefined();
  });

  it('no define window.MMCuenta si falta window.MM_SUPABASE', () => {
    window.supabase = { createClient: () => ({ auth: { onAuthStateChange() {}, getSession: () => Promise.resolve({ data: { session: null } }) }, rpc: () => Promise.resolve({}) }) };
    loadScript('assets/cuenta.js');
    expect(window.MMCuenta).toBeUndefined();
  });

  it('rechaza una contraseña de menos de PASS_MIN caracteres', () => {
    mockSupabaseSdk();
    loadScript('assets/cuenta.js');
    expect(window.MMCuenta.passMin).toBe(6);
    expect(window.MMCuenta.validarPass('Ab1!')).toMatch(/al menos 6 caracteres/);
  });

  it('rechaza una contraseña sin mayúscula', () => {
    mockSupabaseSdk();
    loadScript('assets/cuenta.js');
    expect(window.MMCuenta.validarPass('abcdef!1')).toMatch(/mayúscula/);
  });

  it('rechaza una contraseña sin carácter especial', () => {
    mockSupabaseSdk();
    loadScript('assets/cuenta.js');
    expect(window.MMCuenta.validarPass('Abcdef1')).toMatch(/carácter especial/);
  });

  it('acepta una contraseña que cumple las tres reglas', () => {
    mockSupabaseSdk();
    loadScript('assets/cuenta.js');
    expect(window.MMCuenta.validarPass('Abcdef!1')).toBe('');
  });

  it('el largo mínimo se evalúa antes que las otras reglas (mensaje de largo, no de mayúscula, para "ab")', () => {
    mockSupabaseSdk();
    loadScript('assets/cuenta.js');
    expect(window.MMCuenta.validarPass('ab')).toMatch(/al menos 6 caracteres/);
  });
});
