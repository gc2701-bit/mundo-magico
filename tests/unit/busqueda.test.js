/* lib/busqueda.ts — capa server-side única de búsqueda/filtros (Sprint 1
 * del rediseño de frontend). Pega contra los RPCs catalogo_listar/
 * catalogo_buscar (supabase/catalogo_12_busqueda.sql) vía fetch — acá se
 * prueba el cableado (params correctos, atajos, manejo de error), no
 * Postgres en sí (eso se verificó a mano contra el proyecto real).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { listarCatalogo, buscarCatalogo } from '../../lib/busqueda';
import { siguienteCursorListado, siguienteCursorBusqueda } from '../../lib/busqueda-cursor';

function mockFetchOk(data) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listarCatalogo', () => {
  it('llama a catalogo_listar con los filtros mapeados a los params p_* del RPC', async () => {
    const fetchMock = mockFetchOk({ productos: [], hayMas: false });
    vi.stubGlobal('fetch', fetchMock);

    await listarCatalogo({ mundo: 'cotillon', familia: 'Anteojos', precioMin: 1000, precioMax: 5000, soloStock: true, limite: 12 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toContain('/rest/v1/rpc/catalogo_listar');
    const body = JSON.parse(opciones.body);
    expect(body).toEqual({
      p_mundo: 'cotillon',
      p_familia: 'Anteojos',
      p_precio_min: 1000,
      p_precio_max: 5000,
      p_solo_stock: true,
      p_cursor_orden: null,
      p_cursor_titulo: null,
      p_cursor_id: null,
      p_limite: 12,
    });
  });

  it('sin filtros, manda todos los p_* en null/default — nunca undefined', async () => {
    const fetchMock = mockFetchOk({ productos: [], hayMas: false });
    vi.stubGlobal('fetch', fetchMock);

    await listarCatalogo();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.p_mundo).toBeNull();
    expect(body.p_solo_stock).toBe(false);
    expect(body.p_limite).toBe(24);
  });

  it('manda el cursor de la página anterior tal cual', async () => {
    const fetchMock = mockFetchOk({ productos: [], hayMas: false });
    vi.stubGlobal('fetch', fetchMock);

    await listarCatalogo({ cursor: { orden: 3, titulo: 'Globo', id: 'abc-123' } });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.p_cursor_orden).toBe(3);
    expect(body.p_cursor_titulo).toBe('Globo');
    expect(body.p_cursor_id).toBe('abc-123');
  });

  it('respuesta no-ok del RPC tira un error legible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(listarCatalogo()).rejects.toThrow('catalogo_listar');
  });
});

describe('buscarCatalogo', () => {
  it('con menos de 2 caracteres no llama al RPC — devuelve vacío directo', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await buscarCatalogo('a');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(resultado).toEqual({ productos: [], hayMas: false });
  });

  it('recorta espacios antes de decidir el mínimo de caracteres', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await buscarCatalogo('  a  ');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con 2+ caracteres llama a catalogo_buscar con el texto recortado', async () => {
    const fetchMock = mockFetchOk({ productos: [], hayMas: false });
    vi.stubGlobal('fetch', fetchMock);

    await buscarCatalogo('  globo  ', { mundo: 'cumpleanos', limite: 5 });

    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toContain('/rest/v1/rpc/catalogo_buscar');
    const body = JSON.parse(opciones.body);
    expect(body.p_query).toBe('globo');
    expect(body.p_mundo).toBe('cumpleanos');
    expect(body.p_limite).toBe(5);
  });
});

describe('siguienteCursorListado', () => {
  it('sin productos, no hay cursor siguiente', () => {
    expect(siguienteCursorListado([])).toBeUndefined();
  });
  it('toma orden/titulo/id del último producto de la página', () => {
    const productos = [
      { id: '1', orden: 0, titulo: 'A' },
      { id: '2', orden: 1, titulo: 'B' },
    ];
    expect(siguienteCursorListado(productos)).toEqual({ orden: 1, titulo: 'B', id: '2' });
  });
});

describe('siguienteCursorBusqueda', () => {
  it('sin productos, no hay cursor siguiente', () => {
    expect(siguienteCursorBusqueda([])).toBeUndefined();
  });
  it('toma score/id del último producto de la página', () => {
    const productos = [
      { id: '1', score: 0.9 },
      { id: '2', score: 0.5 },
    ];
    expect(siguienteCursorBusqueda(productos)).toEqual({ score: 0.5, id: '2' });
  });
});
