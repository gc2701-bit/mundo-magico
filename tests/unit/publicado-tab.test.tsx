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
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PublicadoTab from '../../app/components/admin/PublicadoTab';
import { STORAGE_PREFIX } from '../../lib/admin-catalogo';

const { estado, sb, escrituras, storageRemovidas } = vi.hoisted(() => {
  const estado: any = { catalogo_productos: [], catalogo_mundos: [], catalogo_precios: [] };
  const escrituras: any[] = [];
  const storageRemovidas: string[] = [];

  function resultado(data: any) {
    const p: any = Promise.resolve({ data, error: null });
    p.select = () => p;
    p.order = () => p;
    p.eq = () => p;
    p.in = () => p;
    return p;
  }

  function armarEscritura(tabla: string, tipo: 'update' | 'delete', campos?: any) {
    const registro: any = { tabla, tipo, campos, eqs: [], ins: [] };
    escrituras.push(registro);
    const chain: any = resultado({});
    chain.eq = (k: string, v: any) => { registro.eqs.push([k, v]); return chain; };
    chain.in = (k: string, v: any) => { registro.ins.push([k, v]); return chain; };
    return chain;
  }

  const sb = {
    from: (tabla: string) => ({
      select: () => resultado(estado[tabla] || []),
      update: (campos: any) => armarEscritura(tabla, 'update', campos),
      delete: () => armarEscritura(tabla, 'delete')
    }),
    rpc: (nombre: string, args: any) => {
      if (nombre !== 'catalogo_precios_admin') return Promise.resolve({ data: null, error: null });
      const pedidos: string[] = (args && args.p_codigos) || [];
      return Promise.resolve({
        data: estado.catalogo_precios.filter((p: any) => pedidos.indexOf(p.codigo) !== -1),
        error: null
      });
    },
    storage: {
      from: () => ({
        remove: (rutas: string[]) => {
          storageRemovidas.push(...rutas);
          return Promise.resolve({ data: null, error: null });
        }
      })
    }
  };

  return { estado, sb, escrituras, storageRemovidas };
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
  escrituras.length = 0;
  storageRemovidas.length = 0;
});

describe('PublicadoTab — tabla', () => {
  it('pinta una fila por producto con código, nombre, familia, mundo, stock, precio y estado', async () => {
    estado.catalogo_productos = [producto({ id: 'p1', titulo: 'Anteojo estrella', codigo: '001', familia: 'RUIDO', mundo: 'cotillon' })];
    estado.catalogo_precios = [{ codigo: '001', precio: 5000, sin_stock: false, stock: 12 }];

    render(<PublicadoTab />);

    const fila = await screen.findByRole('row', { name: /Anteojo estrella/ });
    const celdas = within(fila).getAllByRole('cell');
    expect(celdas[0]).toHaveTextContent(''); // checkbox de selección
    expect(celdas[1]).toHaveTextContent('001');
    expect(celdas[2]).toHaveTextContent('Anteojo estrella');
    expect(celdas[3]).toHaveTextContent('RUIDO');
    expect(celdas[4]).toHaveTextContent('Cotillón');
    expect(celdas[5]).toHaveTextContent('12');
    expect(celdas[6]).toHaveTextContent('5.000'); // Intl.NumberFormat es-AR usa espacio irrompible antes del número
    expect(celdas[7]).toHaveTextContent('Visible');
  });

  it('sin dato de precio/stock para el código, muestra "—" en vez de inventar un valor', async () => {
    estado.catalogo_productos = [producto({ codigo: '999' })];
    estado.catalogo_precios = [];

    render(<PublicadoTab />);

    const fila = await screen.findByRole('row', { name: /Producto/ });
    const celdas = within(fila).getAllByRole('cell');
    expect(celdas[5]).toHaveTextContent('—');
    expect(celdas[6]).toHaveTextContent('—');
  });

  it('un producto oculto (publicado:false) se muestra igual, con estado "Oculto"', async () => {
    estado.catalogo_productos = [producto({ id: 'p2', titulo: 'Zapallo', publicado: false })];

    render(<PublicadoTab />);

    const fila = await screen.findByRole('row', { name: /Zapallo/ });
    expect(within(fila).getAllByRole('cell')[7]).toHaveTextContent('Oculto');
  });

  it('sin resultados muestra el mensaje, no una tabla vacía', async () => {
    render(<PublicadoTab />);
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('No hay artículos que coincidan.')).toBeInTheDocument();
  });
});

describe('PublicadoTab — responsive: tabla en desktop, tarjetas en mobile', () => {
  beforeEach(() => {
    estado.catalogo_productos = [
      producto({ id: 'p1', titulo: 'Anteojo estrella', codigo: '001', familia: 'RUIDO', mundo: 'cotillon' })
    ];
    estado.catalogo_precios = [{ codigo: '001', precio: 5000, sin_stock: false, stock: 12 }];
  });

  it('la tabla desktop queda oculta bajo el breakpoint lg, la lista de tarjetas visible sólo bajo lg', async () => {
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });

    // Table (components/ui/table.tsx) ya envuelve el <table> en su propio
    // div "relative w-full overflow-x-auto" — el wrapper "hidden lg:block"
    // de este componente es el abuelo, no el padre directo.
    const contenedorTabla = screen.getByRole('table').parentElement?.parentElement;
    expect(contenedorTabla).toHaveClass('hidden', 'lg:block');

    const lista = screen.getByRole('list');
    expect(lista).toHaveClass('lg:hidden');
  });

  it('la tarjeta mobile muestra los mismos datos que la fila de la tabla', async () => {
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });

    const lista = screen.getByRole('list');
    const tarjeta = within(lista).getByText('Anteojo estrella').closest('li')!;
    expect(within(tarjeta).getByText('001')).toBeInTheDocument();
    expect(within(tarjeta).getByText('RUIDO')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Cotillón')).toBeInTheDocument();
    expect(within(tarjeta).getByText('12')).toBeInTheDocument();
    expect(within(tarjeta).getByText(/5\.000/)).toBeInTheDocument();
    expect(within(tarjeta).getByText('Visible')).toBeInTheDocument();
    expect(within(tarjeta).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('el checkbox de una tarjeta mobile selecciona la misma fila que el de la tabla (mismo estado)', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });

    const lista = screen.getByRole('list');
    await user.click(within(lista).getByRole('checkbox', { name: 'Seleccionar Anteojo estrella' }));

    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
    const tabla = screen.getByRole('table');
    expect(within(tabla).getByRole('checkbox', { name: 'Seleccionar Anteojo estrella' })).toBeChecked();
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
    await screen.findByRole('row', { name: /Anteojo estrella/ });
    const tabla = screen.getByRole('table');

    await user.type(screen.getByPlaceholderText('Buscar por título o código'), 'ANTEOJO');

    expect(within(tabla).getByText('Anteojo estrella')).toBeInTheDocument();
    expect(within(tabla).queryByText('Sombrero cowboy')).not.toBeInTheDocument();
  });

  it('filtra por código', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });
    const tabla = screen.getByRole('table');

    await user.type(screen.getByPlaceholderText('Buscar por título o código'), '61147');

    expect(within(tabla).getByText('Sombrero cowboy')).toBeInTheDocument();
    expect(within(tabla).queryByText('Anteojo estrella')).not.toBeInTheDocument();
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
    await screen.findByRole('row', { name: /Con ruido/ });
    const tabla = screen.getByRole('table');

    await user.click(screen.getByRole('combobox', { name: 'Filtrar por familia' }));
    await user.click(await screen.findByRole('option', { name: /sin familia/ }));

    expect(within(tabla).getByText('Sin familia')).toBeInTheDocument();
    expect(within(tabla).queryByText('Con ruido')).not.toBeInTheDocument();
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
    await screen.findByRole('row', { name: /De cotillón/ });
    const tabla = screen.getByRole('table');

    await user.click(screen.getByRole('combobox', { name: 'Filtrar por mundo' }));
    await user.click(await screen.findByRole('option', { name: 'Disfraces' }));

    expect(within(tabla).getByText('De disfraces')).toBeInTheDocument();
    expect(within(tabla).queryByText('De cotillón')).not.toBeInTheDocument();
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
    return within(filas[0]).getAllByRole('cell')[2].textContent; // [0]=checkbox, [1]=código, [2]=nombre
  }

  it('clickear "Código" ordena asc, volver a clickear invierte a desc', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Zapallo/ });

    await user.click(screen.getByRole('columnheader', { name: /Código/ }));
    expect(tituloDeLaPrimeraFila()).toBe('Antifaz'); // código 001 < 002

    await user.click(screen.getByRole('columnheader', { name: /Código/ }));
    expect(tituloDeLaPrimeraFila()).toBe('Zapallo'); // invertido
  });

  it('por default ordena por Nombre asc (mismo orden que .order("titulo") de la query)', async () => {
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Zapallo/ });
    expect(tituloDeLaPrimeraFila()).toBe('Antifaz');
  });
});

describe('PublicadoTab — selección múltiple', () => {
  beforeEach(() => {
    estado.catalogo_productos = [
      producto({ id: 'p1', titulo: 'Anteojo estrella', codigo: '001' }),
      producto({ id: 'p2', titulo: 'Sombrero cowboy', codigo: '61147' })
    ];
    estado.catalogo_precios = [
      { codigo: '001', precio: 1000, sin_stock: false, stock: 5 },
      { codigo: '61147', precio: 2000, sin_stock: false, stock: 3 }
    ];
  });

  it('seleccionar una fila muestra la barra de acciones con el conteo', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });
    const tabla = screen.getByRole('table');

    await user.click(within(tabla).getByRole('checkbox', { name: 'Seleccionar Anteojo estrella' }));

    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
  });

  it('el checkbox del encabezado selecciona todas las filas filtradas, y vuelve a desmarcarlas', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });

    const encabezado = screen.getByRole('checkbox', { name: 'Seleccionar todos' });
    await user.click(encabezado);
    expect(screen.getByText(/2 seleccionados/)).toBeInTheDocument();

    await user.click(encabezado);
    expect(screen.queryByText(/seleccionado/)).not.toBeInTheDocument();
  });

  it('cambiar la búsqueda limpia la selección (una fila seleccionada puede quedar oculta por el filtro)', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });
    const tabla = screen.getByRole('table');

    await user.click(within(tabla).getByRole('checkbox', { name: 'Seleccionar Anteojo estrella' }));
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Buscar por título o código'), 'sombrero');
    expect(screen.queryByText(/seleccionado/)).not.toBeInTheDocument();
  });

  it('"Limpiar selección" vacía la selección sin tocar la base', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });
    const tabla = screen.getByRole('table');

    await user.click(within(tabla).getByRole('checkbox', { name: 'Seleccionar Anteojo estrella' }));
    await user.click(screen.getByRole('button', { name: 'Limpiar selección' }));

    expect(screen.queryByText(/seleccionado/)).not.toBeInTheDocument();
    expect(escrituras).toHaveLength(0);
  });
});

describe('PublicadoTab — lote: ajustar precio', () => {
  beforeEach(() => {
    estado.catalogo_productos = [producto({ id: 'p1', titulo: 'Anteojo estrella', codigo: '001' })];
    estado.catalogo_precios = [{ codigo: '001', precio: 1000, sin_stock: false, stock: 5 }];
  });

  it('sube el precio del código según el porcentaje, redondeado', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });

    await user.click(within(screen.getByRole('table')).getByRole('checkbox', { name: 'Seleccionar Anteojo estrella' }));
    await user.click(screen.getByRole('button', { name: /Ajustar precio/ }));
    await user.type(screen.getByPlaceholderText('Ej: 10'), '10');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    await waitFor(() => expect(screen.queryByText(/seleccionado/)).not.toBeInTheDocument());

    const update = escrituras.find((e: any) => e.tabla === 'catalogo_precios' && e.tipo === 'update');
    expect(update).toBeTruthy();
    expect(update.campos).toEqual({ precio: 1100 });
    expect(update.eqs).toEqual([['codigo', '001']]);
  });

  it('un porcentaje negativo baja el precio, nunca a 0 o menos', async () => {
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });

    await user.click(within(screen.getByRole('table')).getByRole('checkbox', { name: 'Seleccionar Anteojo estrella' }));
    await user.click(screen.getByRole('button', { name: /Ajustar precio/ }));
    await user.type(screen.getByPlaceholderText('Ej: 10'), '-200');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    await waitFor(() => expect(screen.queryByText(/seleccionado/)).not.toBeInTheDocument());

    const update = escrituras.find((e: any) => e.tabla === 'catalogo_precios' && e.tipo === 'update');
    expect(update.campos).toEqual({ precio: 1 });
  });
});

describe('PublicadoTab — lote: sacar de uso', () => {
  it('manda publicado:false a los ids seleccionados en un solo update', async () => {
    estado.catalogo_productos = [
      producto({ id: 'p1', titulo: 'Anteojo estrella', codigo: '001' }),
      producto({ id: 'p2', titulo: 'Sombrero cowboy', codigo: '61147' })
    ];
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });

    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar todos' }));
    await user.click(screen.getByRole('button', { name: /Sacar de uso/ }));

    await waitFor(() => expect(screen.queryByText(/seleccionado/)).not.toBeInTheDocument());

    const update = escrituras.find((e: any) => e.tabla === 'catalogo_productos' && e.tipo === 'update');
    expect(update.campos).toEqual({ publicado: false });
    expect(update.ins).toEqual([['id', ['p1', 'p2']]]);
  });
});

describe('PublicadoTab — lote: eliminar', () => {
  it('pide confirmación antes de borrar', async () => {
    estado.catalogo_productos = [producto({ id: 'p1', titulo: 'Anteojo estrella', codigo: '001' })];
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });

    await user.click(within(screen.getByRole('table')).getByRole('checkbox', { name: 'Seleccionar Anteojo estrella' }));
    await user.click(screen.getByRole('button', { name: /^Eliminar$/ }));

    expect(screen.getByText(/no se puede deshacer/)).toBeInTheDocument();
    expect(escrituras).toHaveLength(0);
  });

  it('confirmar borra las fotos de Storage, el código exclusivo de catalogo_precios y el producto', async () => {
    estado.catalogo_productos = [
      producto({ id: 'p1', titulo: 'Anteojo estrella', codigo: '001', fotos: [{ src: STORAGE_PREFIX + 'anteojo.webp', cap: '' }] })
    ];
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });

    await user.click(within(screen.getByRole('table')).getByRole('checkbox', { name: 'Seleccionar Anteojo estrella' }));
    await user.click(screen.getByRole('button', { name: /^Eliminar$/ }));
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));

    await waitFor(() => expect(screen.queryByText(/seleccionado/)).not.toBeInTheDocument());

    expect(storageRemovidas).toEqual(['anteojo.webp']);
    const delPrecios = escrituras.find((e: any) => e.tabla === 'catalogo_precios' && e.tipo === 'delete');
    expect(delPrecios.ins).toEqual([['codigo', ['001']]]);
    const delProductos = escrituras.find((e: any) => e.tabla === 'catalogo_productos' && e.tipo === 'delete');
    expect(delProductos.ins).toEqual([['id', ['p1']]]);
  });

  it('un código compartido con un producto FUERA del lote no se borra de catalogo_precios', async () => {
    estado.catalogo_productos = [
      producto({ id: 'p1', titulo: 'Anteojo estrella', codigo: '11963' }),
      producto({ id: 'p2', titulo: 'Anteojo redondo', codigo: '11963' })
    ];
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });

    // Sólo se selecciona p1 — p2 sigue usando el código '11963'.
    await user.click(within(screen.getByRole('table')).getByRole('checkbox', { name: 'Seleccionar Anteojo estrella' }));
    await user.click(screen.getByRole('button', { name: /^Eliminar$/ }));
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));

    await waitFor(() => expect(screen.queryByText(/seleccionado/)).not.toBeInTheDocument());

    expect(escrituras.find((e: any) => e.tabla === 'catalogo_precios' && e.tipo === 'delete')).toBeUndefined();
    const delProductos = escrituras.find((e: any) => e.tabla === 'catalogo_productos' && e.tipo === 'delete');
    expect(delProductos.ins).toEqual([['id', ['p1']]]);
  });

  it('un código compartido SÓLO entre dos productos del mismo lote sí se borra (el bug que evita codigosBorrablesLote)', async () => {
    estado.catalogo_productos = [
      producto({ id: 'p1', titulo: 'Anteojo estrella', codigo: '11963' }),
      producto({ id: 'p2', titulo: 'Anteojo redondo', codigo: '11963' })
    ];
    const user = userEvent.setup();
    render(<PublicadoTab />);
    await screen.findByRole('row', { name: /Anteojo estrella/ });

    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar todos' }));
    await user.click(screen.getByRole('button', { name: /^Eliminar$/ }));
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));

    await waitFor(() => expect(screen.queryByText(/seleccionado/)).not.toBeInTheDocument());

    const delPrecios = escrituras.find((e: any) => e.tabla === 'catalogo_precios' && e.tipo === 'delete');
    expect(delPrecios.ins).toEqual([['codigo', ['11963']]]);
  });
});
