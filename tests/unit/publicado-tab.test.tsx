/* app/components/admin/PublicadoTab.tsx — Sprint 1 del plan de catálogo
 * admin (SPEC-catalogo-admin-variantes.md): tabla con columnas
 * Código/Nombre/Familia/Mundo/Stock/Precio/Estado, orden por columna,
 * filtros de búsqueda/familia/mundo.
 *
 * No hay forma de probar esto con Playwright contra una sesión admin real
 * en este entorno (Turnstile bloquea el login, ver el comentario de
 * tests/e2e-next/admin-catalogo.spec.js) — mismo hueco de cobertura ya
 * documentado en ese archivo. Este test monta el componente con un doble
 * mínimo de supabaseBrowser() (mismo criterio que
 * tests/unit/admin-catalogo-render.test.js para el panel legacy) en vez
 * de un e2e real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PublicadoTab from '../../app/components/admin/PublicadoTab';

const { estado, sb } = vi.hoisted(() => {
  const estado: any = { catalogo_productos: [], catalogo_mundos: [], catalogo_precios: [] };

  function resultado(data: any) {
    const p: any = Promise.resolve({ data, error: null });
    p.select = () => p;
    p.order = () => p;
    p.eq = () => p;
    return p;
  }

  const sb = {
    from: (tabla: string) => ({ select: () => resultado(estado[tabla] || []) }),
    rpc: (nombre: string, args: any) => {
      if (nombre !== 'catalogo_precios_admin') return Promise.resolve({ data: null, error: null });
      const pedidos: string[] = (args && args.p_codigos) || [];
      return Promise.resolve({
        data: estado.catalogo_precios.filter((p: any) => pedidos.indexOf(p.codigo) !== -1),
        error: null
      });
    }
  };

  return { estado, sb };
});

vi.mock('@/lib/supabase', () => ({ supabaseBrowser: () => sb }));

function producto(overrides: any) {
  return {
    id: 'p1', titulo: 'Producto', slug: 'producto', codigo: '001', variantes: null,
    familia: 'RUIDO', mundo: 'cotillon', publicado: true, fotos: [], specs: null,
    descripcion: null, tags: null, orden: 0,
    ...overrides
  };
}

const MUNDOS = [
  { slug: 'cotillon', nombre: 'Cotillón' },
  { slug: 'disfraces', nombre: 'Disfraces' }
];

beforeEach(() => {
  estado.catalogo_productos = [];
  estado.catalogo_mundos = MUNDOS;
  estado.catalogo_precios = [];
});

describe('PublicadoTab — tabla', () => {
  it('pinta una fila por producto con código, nombre, familia, mundo, stock, precio y estado', async () => {
    estado.catalogo_productos = [producto({ id: 'p1', titulo: 'Anteojo estrella', codigo: '001', familia: 'RUIDO', mundo: 'cotillon' })];
    estado.catalogo_precios = [{ codigo: '001', precio: 5000, sin_stock: false, stock: 12 }];

    render(<PublicadoTab />);

    const fila = await screen.findByRole('row', { name: /Anteojo estrella/ });
    const celdas = within(fila).getAllByRole('cell');
    expect(celdas[0]).toHaveTextContent('001');
    expect(celdas[1]).toHaveTextContent('Anteojo estrella');
    expect(celdas[2]).toHaveTextContent('RUIDO');
    expect(celdas[3]).toHaveTextContent('Cotillón');
    expect(celdas[4]).toHaveTextContent('12');
    expect(celdas[5]).toHaveTextContent('5.000'); // Intl.NumberFormat es-AR usa espacio irrompible antes del número
    expect(celdas[6]).toHaveTextContent('Visible');
  });

  it('sin dato de precio/stock para el código, muestra "—" en vez de inventar un valor', async () => {
    estado.catalogo_productos = [producto({ codigo: '999' })];
    estado.catalogo_precios = [];

    render(<PublicadoTab />);

    const fila = await screen.findByRole('row', { name: /Producto/ });
    const celdas = within(fila).getAllByRole('cell');
    expect(celdas[4]).toHaveTextContent('—');
    expect(celdas[5]).toHaveTextContent('—');
  });

  it('un producto oculto (publicado:false) se muestra igual, con estado "Oculto"', async () => {
    estado.catalogo_productos = [producto({ id: 'p2', titulo: 'Zapallo', publicado: false })];

    render(<PublicadoTab />);

    const fila = await screen.findByRole('row', { name: /Zapallo/ });
    expect(within(fila).getAllByRole('cell')[6]).toHaveTextContent('Oculto');
  });

  it('sin resultados muestra el mensaje, no una tabla vacía', async () => {
    render(<PublicadoTab />);
    expect(await screen.findByText('No hay artículos que coincidan.')).toBeInTheDocument();
  });
});

describe('PublicadoTab — búsqueda', () => {
  beforeEach(() => {
    estado.catalogo_productos = [
      producto({ id: 'p1', titulo: 'Anteojo estrella', codigo: '001' }),
      producto({ id: 'p2', titulo: 'Sombrero cowboy', codigo: '61147' })
    ];
  });

  it('filtra por título sin importar mayúsculas', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByText('Anteojo estrella');

    await user.type(screen.getByPlaceholderText('Buscar por título o código'), 'ANTEOJO');

    expect(screen.getByText('Anteojo estrella')).toBeInTheDocument();
    expect(screen.queryByText('Sombrero cowboy')).not.toBeInTheDocument();
  });

  it('filtra por código', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByText('Anteojo estrella');

    await user.type(screen.getByPlaceholderText('Buscar por título o código'), '61147');

    expect(screen.getByText('Sombrero cowboy')).toBeInTheDocument();
    expect(screen.queryByText('Anteojo estrella')).not.toBeInTheDocument();
  });
});

describe('PublicadoTab — filtro de familia', () => {
  beforeEach(() => {
    estado.catalogo_productos = [
      producto({ id: 'p1', titulo: 'Con ruido', familia: 'RUIDO' }),
      producto({ id: 'p2', titulo: 'Sin familia', familia: null })
    ];
  });

  it('"— sin familia —" deja sólo los productos sin familia asignada', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByText('Con ruido');

    await user.click(screen.getByRole('combobox', { name: 'Filtrar por familia' }));
    await user.click(await screen.findByRole('option', { name: /sin familia/ }));

    expect(screen.getByText('Sin familia')).toBeInTheDocument();
    expect(screen.queryByText('Con ruido')).not.toBeInTheDocument();
  });
});

describe('PublicadoTab — filtro de mundo', () => {
  beforeEach(() => {
    estado.catalogo_productos = [
      producto({ id: 'p1', titulo: 'De cotillón', mundo: 'cotillon' }),
      producto({ id: 'p2', titulo: 'De disfraces', mundo: 'disfraces' })
    ];
  });

  it('elegir un mundo deja sólo esos productos', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByText('De cotillón');

    await user.click(screen.getByRole('combobox', { name: 'Filtrar por mundo' }));
    await user.click(await screen.findByRole('option', { name: 'Disfraces' }));

    expect(screen.getByText('De disfraces')).toBeInTheDocument();
    expect(screen.queryByText('De cotillón')).not.toBeInTheDocument();
  });
});

describe('PublicadoTab — orden por columna', () => {
  beforeEach(() => {
    estado.catalogo_productos = [
      producto({ id: 'p1', titulo: 'Zapallo', codigo: '002' }),
      producto({ id: 'p2', titulo: 'Antifaz', codigo: '001' })
    ];
  });

  function tituloDeLaPrimeraFila() {
    const filas = screen.getAllByRole('row').slice(1); // sin el header
    return within(filas[0]).getAllByRole('cell')[1].textContent;
  }

  it('clickear "Código" ordena asc, volver a clickear invierte a desc', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByText('Zapallo');

    await user.click(screen.getByRole('columnheader', { name: /Código/ }));
    expect(tituloDeLaPrimeraFila()).toBe('Antifaz'); // código 001 < 002

    await user.click(screen.getByRole('columnheader', { name: /Código/ }));
    expect(tituloDeLaPrimeraFila()).toBe('Zapallo'); // invertido
  });

  it('por default ordena por Nombre asc (mismo orden que .order("titulo") de la query)', async () => {
    render(<PublicadoTab />);
    await screen.findByText('Zapallo');
    expect(tituloDeLaPrimeraFila()).toBe('Antifaz');
  });
});
