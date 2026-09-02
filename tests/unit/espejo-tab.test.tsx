/* app/components/admin/EspejoTab.tsx — el usuario pidió que la lista
 * "Sin activar" sea una copia visual de la de "Publicado"
 * (PublicadoTab.tsx): misma tabla en desktop (shadcn Table, table-fixed,
 * columnas en %, truncado con ellipsis en Familia — mismo fix que el bug
 * de superposición de PublicadoTab), misma lista de tarjetas en mobile.
 * La única diferencia real tiene que ser que estos artículos no están
 * publicados (acá el CTA es "Activar" en vez de "Editar", sin columnas
 * de Mundo/Estado porque todavía no están categorizados).
 *
 * Mismo criterio que tests/unit/publicado-tab.test.tsx: doble mínimo de
 * supabaseBrowser() en vez de un e2e real (Turnstile bloquea el login
 * admin en este entorno).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EspejoTab from '../../app/components/admin/EspejoTab';

const { estado, sb, escrituras, subirFotoMock } = vi.hoisted(() => {
  const estado: any = { catalogo_buho_espejo: [], catalogo_mundos: [], catalogo_productos: [], _preciosExistentes: new Set<string>() };
  const escrituras: any[] = [];
  const subirFotoMock = vi.fn().mockResolvedValue('https://kyuilrlewynqrzebouww.supabase.co/storage/v1/object/public/catalogo/foto.webp');

  function chain(data: any) {
    const p: any = Promise.resolve({ data, error: null });
    p.select = () => p;
    p.eq = () => p;
    p.order = () => p;
    p.or = () => p;
    return p;
  }

  function armarEscritura(tabla: string, tipo: 'insert' | 'upsert' | 'update', campos: any) {
    const registro: any = { tabla, tipo, campos, eqs: [] };
    escrituras.push(registro);
    // catalogo_precios real tiene `codigo` primary key SIN grant de UPDATE
    // (a propósito, ver catalogo_00_base.sql) — un insert de un código que
    // el worker de Búho ya sincronizó choca con unique_violation (23505),
    // igual que en Postgres real.
    let error: any = null;
    if (tabla === 'catalogo_precios' && tipo === 'insert' && estado._preciosExistentes.has(campos.codigo)) {
      error = { code: '23505', message: 'duplicate key value violates unique constraint "catalogo_precios_pkey"' };
    }
    const promesa: any = Promise.resolve({ data: null, error });
    promesa.eq = (k: string, v: any) => { registro.eqs.push([k, v]); return promesa; };
    return promesa;
  }

  const sb = {
    from: (tabla: string) => ({
      select: () => chain(estado[tabla] || []),
      insert: (campos: any) => armarEscritura(tabla, 'insert', campos),
      upsert: (campos: any) => armarEscritura(tabla, 'upsert', campos),
      update: (campos: any) => armarEscritura(tabla, 'update', campos)
    })
  };

  return { estado, sb, escrituras, subirFotoMock };
});

vi.mock('@/lib/supabase', () => ({ supabaseBrowser: () => sb }));

// procesarFoto usa createImageBitmap/canvas — jsdom no lo simula (mismo
// motivo que tests/unit/producto-edit-modal.test.tsx). subirFoto se
// stubea para poder afirmar CON QUÉ argumentos se llamó — es lo que este
// bug rompía (fila.codigo/carpeta crudos, ver tasks/plan-activar-invalid-key.md).
vi.mock('@/lib/procesar-foto', () => ({
  procesarFoto: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/webp' })),
  subirFoto: subirFotoMock
}));

function fila(overrides: any) {
  return {
    codigo: '001', nombre: 'Producto espejo', familia: 'RUIDO',
    precio: 1000, stock: 5, es_combo: false,
    ...overrides
  };
}

beforeEach(() => {
  estado.catalogo_buho_espejo = [];
  estado.catalogo_mundos = [];
  estado.catalogo_productos = [];
  estado._preciosExistentes = new Set<string>();
  escrituras.length = 0;
  subirFotoMock.mockClear();
});

async function activarHastaElFinal(user: ReturnType<typeof userEvent.setup>, nombreProducto: string, mundoSlug = 'cotillon') {
  const fil = await screen.findByRole('row', { name: new RegExp(nombreProducto) });
  await user.click(within(fil).getByRole('button', { name: 'Activar' }));

  const input = screen.getByLabelText(/Foto \(obligatoria para activar/);
  await user.upload(input, new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
  await screen.findByAltText(nombreProducto);

  await user.selectOptions(screen.getByLabelText(/Mundo \(obligatorio para activar\)/), mundoSlug);
  await user.click(screen.getByRole('button', { name: 'Activar' }));
}

describe('EspejoTab — misma estructura visual que PublicadoTab', () => {
  it('desktop: tabla oculta bajo lg, lista de tarjetas visible sólo bajo lg (mismo patrón que PublicadoTab)', async () => {
    estado.catalogo_buho_espejo = [fila({})];
    render(<EspejoTab />);
    await screen.findByRole('row', { name: /Producto espejo/ });

    // Table (components/ui/table.tsx) ya envuelve el <table> en su propio
    // div "relative w-full overflow-x-auto" — el wrapper "hidden lg:block"
    // de este componente es el abuelo, no el padre directo (mismo caso
    // que tests/unit/publicado-tab.test.tsx).
    const contenedorTabla = screen.getByRole('table').parentElement?.parentElement;
    expect(contenedorTabla).toHaveClass('hidden', 'lg:block');

    const lista = screen.getByRole('list');
    expect(lista).toHaveClass('lg:hidden');
  });

  it('pinta una fila por artículo con código, nombre, familia, precio, stock y tipo', async () => {
    estado.catalogo_buho_espejo = [fila({ codigo: '77', nombre: 'Antifaz espejo', familia: 'DISFRACES', precio: 2500, stock: 8, es_combo: true })];
    render(<EspejoTab />);

    const fil = await screen.findByRole('row', { name: /Antifaz espejo/ });
    const celdas = within(fil).getAllByRole('cell');
    expect(celdas[0]).toHaveTextContent('77');
    expect(celdas[1]).toHaveTextContent('Antifaz espejo');
    expect(celdas[2]).toHaveTextContent('DISFRACES');
    expect(celdas[3]).toHaveTextContent('2.500');
    expect(celdas[4]).toHaveTextContent('8');
    expect(celdas[5]).toHaveTextContent('Combo');
  });

  it('la celda de Familia trunca con ellipsis (mismo fix que el bug de superposición de PublicadoTab)', async () => {
    estado.catalogo_buho_espejo = [fila({ familia: 'UNA_FAMILIA_MUY_LARGA_SIN_ESPACIOS' })];
    render(<EspejoTab />);

    const fil = await screen.findByRole('row', { name: /Producto espejo/ });
    const celdas = within(fil).getAllByRole('cell');
    expect(celdas[2]).toHaveClass('truncate');
  });

  it('"Activar" en la fila de la tabla abre la pantalla de activación', async () => {
    const user = userEvent.setup();
    estado.catalogo_buho_espejo = [fila({ nombre: 'Producto a activar' })];
    render(<EspejoTab />);

    const fil = await screen.findByRole('row', { name: /Producto a activar/ });
    await user.click(within(fil).getByRole('button', { name: 'Activar' }));

    expect(screen.getByRole('heading', { name: 'Producto a activar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a la lista' })).toBeInTheDocument();
  });

  it('la tarjeta mobile muestra los mismos datos que la fila de la tabla, con su propio "Activar"', async () => {
    const user = userEvent.setup();
    estado.catalogo_buho_espejo = [fila({ codigo: '99', nombre: 'Gorro espejo', familia: 'COTILLON', precio: 1500, stock: 3, es_combo: false })];
    render(<EspejoTab />);
    await screen.findByRole('row', { name: /Gorro espejo/ });

    const lista = screen.getByRole('list');
    const tarjeta = within(lista).getByText('Gorro espejo').closest('li')!;
    expect(within(tarjeta).getByText('99')).toBeInTheDocument();
    expect(within(tarjeta).getByText('COTILLON')).toBeInTheDocument();
    expect(within(tarjeta).getByText('3')).toBeInTheDocument();
    expect(within(tarjeta).getByText(/1\.500/)).toBeInTheDocument();
    expect(within(tarjeta).getByText('Artículo')).toBeInTheDocument();

    await user.click(within(tarjeta).getByRole('button', { name: 'Activar' }));
    expect(screen.getByRole('heading', { name: 'Gorro espejo' })).toBeInTheDocument();
  });

  it('sin artículos (y sin búsqueda) muestra "No hay artículos para activar todavía." en la tabla y en la lista mobile', async () => {
    render(<EspejoTab />);
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('No hay artículos para activar todavía.')).toBeInTheDocument();
    const lista = screen.getByRole('list');
    expect(within(lista).getByText('No hay artículos para activar todavía.')).toBeInTheDocument();
  });
});

describe('ActivacionEspejo — sanea código/carpeta antes de subir foto (fix Invalid key, ver tasks/plan-activar-invalid-key.md)', () => {
  it('sube la foto con el código y la carpeta sin ñ/tildes, aunque fila.codigo/fila.familia los traigan', async () => {
    const user = userEvent.setup();
    estado.catalogo_buho_espejo = [fila({ codigo: 'MOÑOLUZ', nombre: 'Moño luminoso', familia: 'LUMINOSOS' })];
    render(<EspejoTab />);

    const fil = await screen.findByRole('row', { name: /Moño luminoso/ });
    await user.click(within(fil).getByRole('button', { name: 'Activar' }));

    const input = screen.getByLabelText(/Foto \(obligatoria para activar/);
    const archivo = new File(['x'], 'moño.jpg', { type: 'image/jpeg' });
    await user.upload(input, archivo);

    expect(subirFotoMock).toHaveBeenCalledTimes(1);
    const [, , carpeta, slugProducto] = subirFotoMock.mock.calls[0];
    expect(carpeta).toBe('luminosos');
    expect(slugProducto).toBe('monoluz');
  });

  it('al activar, catalogo_productos.codigo sigue siendo el código crudo de Búho (no el sanitizado) — no romper el matcheo con el POS', async () => {
    const user = userEvent.setup();
    estado.catalogo_buho_espejo = [fila({ codigo: 'MOÑOLUZ', nombre: 'Moño luminoso', familia: 'LUMINOSOS' })];
    estado.catalogo_mundos = [{ slug: 'cotillon', nombre: 'Cotillón' }];
    render(<EspejoTab />);

    const fil = await screen.findByRole('row', { name: /Moño luminoso/ });
    await user.click(within(fil).getByRole('button', { name: 'Activar' }));

    const input = screen.getByLabelText(/Foto \(obligatoria para activar/);
    await user.upload(input, new File(['x'], 'moño.jpg', { type: 'image/jpeg' }));
    await screen.findByAltText('Moño luminoso');

    await user.selectOptions(screen.getByLabelText(/Mundo \(obligatorio para activar\)/), 'cotillon');
    await user.click(screen.getByRole('button', { name: 'Activar' }));

    const insertProducto = await vi.waitFor(() => {
      const registro = escrituras.find((e) => e.tabla === 'catalogo_productos' && e.tipo === 'insert');
      if (!registro) throw new Error('todavía no se llamó insert en catalogo_productos');
      return registro;
    });
    expect(insertProducto.campos.codigo).toBe('MOÑOLUZ');
  });
});

describe('ActivacionEspejo — guarda el precio aunque el worker de Búho ya haya sincronizado ese código antes de publicarlo', () => {
  it('si catalogo_precios YA tiene una fila para ese código (bug real: "permission denied for table catalogo_precios"), cae a UPDATE en vez de romper', async () => {
    const user = userEvent.setup();
    estado.catalogo_buho_espejo = [fila({ codigo: '001', nombre: 'Producto ya sincronizado', precio: 3000, stock: 7 })];
    estado.catalogo_mundos = [{ slug: 'cotillon', nombre: 'Cotillón' }];
    estado._preciosExistentes = new Set(['001']);

    render(<EspejoTab />);
    await activarHastaElFinal(user, 'Producto ya sincronizado');

    // No debe quedar un error visible ni la pantalla de activación trabada.
    await vi.waitFor(() => {
      expect(screen.queryByText(/permission denied/i)).not.toBeInTheDocument();
    });

    const insertPrecio = escrituras.find((e) => e.tabla === 'catalogo_precios' && e.tipo === 'insert');
    expect(insertPrecio).toBeTruthy();

    const updatePrecio = await vi.waitFor(() => {
      const registro = escrituras.find((e) => e.tabla === 'catalogo_precios' && e.tipo === 'update');
      if (!registro) throw new Error('todavía no se llamó update en catalogo_precios');
      return registro;
    });
    // Clave del fix: el UPDATE nunca debe incluir `codigo` (columna sin
    // GRANT de UPDATE a propósito) — sólo precio/stock/sin_stock.
    expect(updatePrecio.campos).toEqual({ precio: 3000, stock: 7, sin_stock: false });
    expect(updatePrecio.eqs).toEqual([['codigo', '001']]);

    // Y el flujo completo de activación sigue hasta el final (se marca
    // publicado en catalogo_buho_espejo), no queda a mitad de camino.
    await vi.waitFor(() => {
      const marcaPublicado = escrituras.find((e) => e.tabla === 'catalogo_buho_espejo' && e.tipo === 'update');
      if (!marcaPublicado) throw new Error('todavía no se marcó publicado en catalogo_buho_espejo');
      expect(marcaPublicado.eqs).toEqual([['codigo', '001']]);
    });
  });

  it('si catalogo_precios NO tiene fila para ese código, el INSERT alcanza y no dispara ningún UPDATE', async () => {
    const user = userEvent.setup();
    estado.catalogo_buho_espejo = [fila({ codigo: '002', nombre: 'Producto nuevo de precio', precio: 1200, stock: null })];
    estado.catalogo_mundos = [{ slug: 'cotillon', nombre: 'Cotillón' }];
    // _preciosExistentes vacío: este código todavía no tiene fila.

    render(<EspejoTab />);
    await activarHastaElFinal(user, 'Producto nuevo de precio');

    const insertPrecio = await vi.waitFor(() => {
      const registro = escrituras.find((e) => e.tabla === 'catalogo_precios' && e.tipo === 'insert');
      if (!registro) throw new Error('todavía no se llamó insert en catalogo_precios');
      return registro;
    });
    expect(insertPrecio.campos).toEqual({ codigo: '002', precio: 1200, stock: null, sin_stock: false });
    expect(escrituras.some((e) => e.tabla === 'catalogo_precios' && e.tipo === 'update')).toBe(false);
  });
});

describe('ActivacionEspejo — reintentar un código que quedó a mitad de camino por el bug de precio (ej. combos)', () => {
  it('si catalogo_productos YA tiene una fila para ese código (bug real: "duplicate key value violates catalogo_productos_slug_por_pagina"), no inserta de nuevo — sólo sincroniza precio y marca publicado', async () => {
    const user = userEvent.setup();
    estado.catalogo_buho_espejo = [fila({ codigo: 'MOÑOLUZ', nombre: 'COMBO MOÑO CON LUZ Y LENTEJUELA X12', familia: 'LUMINOSOS', precio: 22000, stock: 45, es_combo: true })];
    estado.catalogo_mundos = [{ slug: 'globos-fiesta', nombre: 'Globos y fiesta' }];
    // El producto ya existe (insertado en un intento anterior que murió en
    // el paso de precio, antes del fix de arriba) — activar() no debería
    // volver a insertarlo.
    estado.catalogo_productos = [{ id: 'ya-existente' }];

    render(<EspejoTab />);
    await activarHastaElFinal(user, 'COMBO MOÑO CON LUZ Y LENTEJUELA X12', 'globos-fiesta');

    await vi.waitFor(() => {
      expect(screen.queryByText(/duplicate key|slug_por_pagina/i)).not.toBeInTheDocument();
    });

    expect(escrituras.some((e) => e.tabla === 'catalogo_productos' && e.tipo === 'insert')).toBe(false);

    const insertPrecio = await vi.waitFor(() => {
      const registro = escrituras.find((e) => e.tabla === 'catalogo_precios' && e.tipo === 'insert');
      if (!registro) throw new Error('todavía no se llamó insert en catalogo_precios');
      return registro;
    });
    expect(insertPrecio.campos).toEqual({ codigo: 'MOÑOLUZ', precio: 22000, stock: 45, sin_stock: false });

    await vi.waitFor(() => {
      const marcaPublicado = escrituras.find((e) => e.tabla === 'catalogo_buho_espejo' && e.tipo === 'update');
      if (!marcaPublicado) throw new Error('todavía no se marcó publicado en catalogo_buho_espejo');
      expect(marcaPublicado.eqs).toEqual([['codigo', 'MOÑOLUZ']]);
    });
  });
});
