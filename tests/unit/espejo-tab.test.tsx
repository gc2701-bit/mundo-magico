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

const { estado, sb } = vi.hoisted(() => {
  const estado: any = { catalogo_buho_espejo: [] };

  function chain(data: any) {
    const p: any = Promise.resolve({ data, error: null });
    p.select = () => p;
    p.eq = () => p;
    p.order = () => p;
    p.or = () => p;
    return p;
  }

  const sb = {
    from: (tabla: string) => ({
      select: () => chain(estado[tabla] || [])
    })
  };

  return { estado, sb };
});

vi.mock('@/lib/supabase', () => ({ supabaseBrowser: () => sb }));

function fila(overrides: any) {
  return {
    codigo: '001', nombre: 'Producto espejo', familia: 'RUIDO',
    precio: 1000, stock: 5, es_combo: false,
    ...overrides
  };
}

beforeEach(() => {
  estado.catalogo_buho_espejo = [];
});

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
