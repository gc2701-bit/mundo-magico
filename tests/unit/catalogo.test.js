/* assets/catalogo.js — la capa de datos del catálogo. Es el módulo más
 * importante del sitio (ver mundo-magico/CLAUDE.md): resuelve precios/stock
 * por una cascada de 5 fuentes, en orden de confianza decreciente:
 *
 *   1. sessionStorage (10 min)
 *   2. Supabase (catalogo_publico())
 *   3. localStorage "último bueno"
 *   4. window.__PRECIOS_DATOS__ (respaldo local estático)
 *   5. vacío ("sin-datos") — nunca se inventa un precio
 *
 * Cada test de acá fuerza a que la fuente de arriba falle (o no exista) y
 * verifica que la cascada realmente cae al siguiente escalón — no que el
 * módulo "funcione en general".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadScript } from '../helpers/loadScript.js';

const SESSION_KEY = 'mm_catalogo_v1';
const LOCAL_KEY = 'mm_catalogo_ok';

function datosSupabaseCrudos(overrides) {
  return Object.assign({
    precios: { '04375': 1000 },
    sinStock: ['04375'],
    fotos: { 'foto.jpg': '04375' },
    tarjetas: {},
    subcategorias: {},
    productos: []
  }, overrides);
}

// Simula assets/cuenta.js: MMCatalogo nunca crea su propio cliente de
// Supabase, siempre reusa window.MMCuenta.cliente() (ver comentario de
// cabecera del archivo real). `rpcImpl` decide qué devuelve catalogo_publico().
function mockMMCuenta(rpcImpl) {
  window.MMCuenta = {
    cliente: () => ({
      rpc: (nombre) => {
        if (nombre !== 'catalogo_publico') return Promise.resolve({ data: null, error: new Error('rpc desconocida') });
        return rpcImpl();
      }
    })
  };
}

function cargarPromise() {
  return new Promise((resolve) => window.MMCatalogo.cargar(resolve));
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  delete window.MMCuenta;
  delete window.__PRECIOS_DATOS__;
  vi.useRealTimers();
});

afterEach(() => {
  // Cada test carga el script de nuevo (módulo con estado propio en
  // closure): sin este reset, `cache`/`pendiente` de un test contaminarían
  // al siguiente.
  delete window.MMCatalogo;
});

describe('MMCatalogo — cascada de origen de datos', () => {
  it('tier 1: usa sessionStorage cuando hay una entrada vigente (<10 min), sin llamar a Supabase', async () => {
    const rpc = vi.fn();
    mockMMCuenta(rpc);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      t: Date.now(),
      d: { origen: 'cache', precios: { X: 1 }, sinStock: {}, fotos: {}, tarjetas: {}, subcategorias: {}, productos: [] }
    }));

    loadScript('assets/catalogo.js');
    const datos = await cargarPromise();

    expect(datos.origen).toBe('cache');
    expect(datos.precios).toEqual({ X: 1 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('tier 1 expira a los 10 minutos: una entrada vieja NO se usa, cae a Supabase', async () => {
    mockMMCuenta(() => Promise.resolve({ data: datosSupabaseCrudos(), error: null }));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      t: Date.now() - 11 * 60000, // 11 minutos: vencida
      d: { origen: 'cache', precios: { VIEJO: 1 }, sinStock: {}, fotos: {}, tarjetas: {}, subcategorias: {}, productos: [] }
    }));

    loadScript('assets/catalogo.js');
    const datos = await cargarPromise();

    expect(datos.origen).toBe('supabase');
    expect(datos.precios).toEqual({ '04375': 1000 });
  });

  it('tier 2: sin cache de sesión, Supabase responde bien → origen "supabase" y sinStock pasa de array a set', async () => {
    mockMMCuenta(() => Promise.resolve({ data: datosSupabaseCrudos(), error: null }));

    loadScript('assets/catalogo.js');
    const datos = await cargarPromise();

    expect(datos.origen).toBe('supabase');
    expect(datos.sinStock).toEqual({ '04375': true }); // normalizar(): array -> set
    expect(datos.precios).toEqual({ '04375': 1000 });
  });

  it('normaliza pocasUnidades de la RPC (array) a un set por código, igual que sinStock', async () => {
    mockMMCuenta(() => Promise.resolve({
      data: Object.assign(datosSupabaseCrudos(), { pocasUnidades: ['04375', '09821'] }),
      error: null
    }));
    loadScript('assets/catalogo.js');
    const datos = await cargarPromise();

    expect(datos.pocasUnidades).toEqual({ '04375': true, '09821': true });
  });

  it('sin pocasUnidades en la respuesta (RPC vieja, antes de la migración): no rompe, queda vacío', async () => {
    mockMMCuenta(() => Promise.resolve({ data: datosSupabaseCrudos(), error: null }));
    loadScript('assets/catalogo.js');
    const datos = await cargarPromise();

    expect(datos.pocasUnidades).toEqual({});
  });

  it('tier 2 éxito: además persiste en sessionStorage Y localStorage (para el próximo "último bueno")', async () => {
    mockMMCuenta(() => Promise.resolve({ data: datosSupabaseCrudos(), error: null }));

    loadScript('assets/catalogo.js');
    await cargarPromise();

    expect(JSON.parse(sessionStorage.getItem(SESSION_KEY)).d.precios).toEqual({ '04375': 1000 });
    expect(JSON.parse(localStorage.getItem(LOCAL_KEY)).d.precios).toEqual({ '04375': 1000 });
  });

  it('tier 3: Supabase devuelve error, pero hay "último bueno" en localStorage → se usa ese', async () => {
    mockMMCuenta(() => Promise.resolve({ data: null, error: new Error('caído') }));
    localStorage.setItem(LOCAL_KEY, JSON.stringify({
      t: Date.now() - 999999999, // el "último bueno" NO tiene TTL, incluso viejo sirve
      d: { precios: { ULTIMO: 500 }, sinStock: {}, fotos: {}, tarjetas: {} }
    }));

    loadScript('assets/catalogo.js');
    const datos = await cargarPromise();

    expect(datos.origen).toBe('ultimo-bueno');
    expect(datos.precios).toEqual({ ULTIMO: 500 });
  });

  it('tier 3: también cae acá si window.MMCuenta no existe (cuenta.js no cargó)', async () => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({
      t: Date.now(),
      d: { precios: { ULTIMO: 500 }, sinStock: {}, fotos: {}, tarjetas: {} }
    }));

    loadScript('assets/catalogo.js'); // sin mockMMCuenta(): window.MMCuenta queda undefined
    const datos = await cargarPromise();

    expect(datos.origen).toBe('ultimo-bueno');
  });

  it('tier 4: sin sesión de Supabase y sin "último bueno" → cae al respaldo estático window.__PRECIOS_DATOS__', async () => {
    mockMMCuenta(() => Promise.resolve({ data: null, error: new Error('caído') }));
    window.__PRECIOS_DATOS__ = { RESPALDO: 999 };

    loadScript('assets/catalogo.js');
    const datos = await cargarPromise();

    expect(datos.origen).toBe('respaldo-local');
    expect(datos.precios).toEqual({ RESPALDO: 999 });
  });

  it('tier 5: no hay absolutamente ninguna fuente → "sin-datos", nunca se inventa un precio', async () => {
    mockMMCuenta(() => Promise.resolve({ data: null, error: new Error('caído') }));

    loadScript('assets/catalogo.js');
    const datos = await cargarPromise();

    expect(datos.origen).toBe('sin-datos');
    expect(datos.precios).toEqual({});
  });

  it('perdioLosCeros(): si Supabase devuelve muchos menos códigos con cero inicial que el respaldo local, se descarta como fuente confiable (guarda contra una migración rota)', async () => {
    // 20+ códigos con cero inicial en el respaldo local, ninguno en la
    // respuesta "en vivo": exactamente la migración rota que este chequeo
    // existe para detectar (ver comentario de perdioLosCeros en catalogo.js).
    const local = {};
    for (let i = 0; i < 25; i++) local['0' + (1000 + i)] = 100;
    window.__PRECIOS_DATOS__ = local;

    mockMMCuenta(() => Promise.resolve({
      data: datosSupabaseCrudos({ precios: { '9999': 100 } }), // sin ceros
      error: null
    }));

    loadScript('assets/catalogo.js');
    const datos = await cargarPromise();

    // Supabase se descarta por perdioLosCeros(): sin "último bueno" en
    // localStorage, cae directo al respaldo estático.
    expect(datos.origen).toBe('respaldo-local');
  });

  it('cargar() no dispara dos pedidos en paralelo si se llama dos veces antes de resolver (guarda "pendiente")', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: datosSupabaseCrudos(), error: null }));
    mockMMCuenta(rpc);

    loadScript('assets/catalogo.js');
    const p1 = cargarPromise();
    const p2 = cargarPromise();
    await Promise.all([p1, p2]);

    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('parche(): mezcla un cambio en memoria sin esperar el próximo fetch, e invalida la cache de sesión', async () => {
    mockMMCuenta(() => Promise.resolve({ data: datosSupabaseCrudos(), error: null }));
    loadScript('assets/catalogo.js');
    await cargarPromise();

    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();

    window.MMCatalogo.parche({ precios: { '04375': 2500 }, sinStock: { '04375': false } });

    expect(window.MMCatalogo.datos().precios['04375']).toBe(2500);
    // La cache de sesión se invalida: la próxima carga de página (no esta
    // misma pestaña) va a buscar a Supabase en vez de servir el blob viejo.
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('parche() es un no-op seguro si todavía no se resolvió ninguna carga (cache null)', async () => {
    loadScript('assets/catalogo.js');
    expect(() => window.MMCatalogo.parche({ precios: { X: 1 } })).not.toThrow();
    expect(window.MMCatalogo.datos()).toBeNull();
  });

  it('refrescar(): limpia la cache en memoria y la de sesión, y vuelve a resolver desde cero', async () => {
    let llamada = 0;
    mockMMCuenta(() => {
      llamada++;
      return Promise.resolve({
        data: datosSupabaseCrudos({ precios: { X: llamada } }),
        error: null
      });
    });

    loadScript('assets/catalogo.js');
    const primero = await cargarPromise();
    expect(primero.precios.X).toBe(1);

    const segundo = await new Promise((resolve) => window.MMCatalogo.refrescar(resolve));
    expect(segundo.precios.X).toBe(2);
  });
});
