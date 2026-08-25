/* app/components/carrito/AccionesProducto.tsx — selector talle×tipo con
 * filtrado mutuo en la ficha de producto (Sprint 5 del plan de catálogo
 * admin, SPEC-catalogo-admin-variantes.md sección 6).
 *
 * No hay ningún producto real con matriz talle×color en el catálogo hoy
 * (confirmado explorando la base — todos los productos con variantes
 * usan sólo el eje talle) — mismo motivo que documenta
 * lib/precios-familia.ts sobre no inventar datos: un e2e Playwright
 * necesitaría sembrar un producto de prueba en la base real que se usa
 * para el build estático (generateStaticParams corre contra
 * kyuilrlewynqrzebouww). En su lugar, este test monta AgregarControl de
 * verdad con un doble de useCarrito() (igual criterio que los tests del
 * panel admin con supabaseBrowser) y de obtenerPreciosPublicos(), con
 * una matriz talle×color armada a mano.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgregarControl } from '../../app/components/carrito/AccionesProducto';

// Los montos se comparan por regex de dígitos (/1\.000/, etc.), no por
// string exacto — Intl.NumberFormat('es-AR') usa un espacio irrompible
// entre "$" y el número, y el normalizador de whitespace de Testing
// Library colapsa eso a un espacio normal en el DOM pero no en el string
// que uno le pasa como matcher, así que una comparación exacta con el
// mismo formateador nunca matchea.

const { carrito } = vi.hoisted(() => ({
  carrito: {
    agregar: vi.fn(),
    cantidadDe: vi.fn(() => 0),
    cantidadTotalDe: vi.fn(() => 0),
    setCantidad: vi.fn(),
    abrirPanel: vi.fn()
  }
}));

vi.mock('../../app/components/carrito/CarritoProvider', () => ({
  useCarrito: () => carrito
}));

const { precios } = vi.hoisted(() => ({
  precios: {
    precios: { CR: 1000, CA: 1200, GR: 2000 }, // GA (Grande×Azul) no tiene precio -> "Consultar precio"
    sinStock: { GR: true },
    pocasUnidades: { CA: true }
  }
}));

vi.mock('../../lib/catalogo-precios-publico', () => ({
  obtenerPreciosPublicos: () => Promise.resolve(precios)
}));

const MATRIZ = [
  { talle: 'Chico', tipo: 'Rojo', codigo: 'CR', activo: true, imagen: 'https://cdn/chico-rojo.webp' },
  { talle: 'Chico', tipo: 'Azul', codigo: 'CA', activo: true },
  { talle: 'Chico', tipo: 'Verde', codigo: 'CV', activo: true }, // sin precio en el mapa mockeado
  { talle: 'Grande', tipo: 'Rojo', codigo: 'GR', activo: true },
  { talle: 'Grande', tipo: 'Azul', codigo: 'GA', activo: false } // sacada de la venta
];

function producto(overrides: any = {}) {
  return {
    id: 'p1', titulo: 'Anteojo estrella', slug: 'anteojo-estrella', codigo: null,
    variantes: MATRIZ, familia: null, mundo: 'cotillon', fotos: [{ src: 'anteojo.jpg', cap: '' }],
    specs: null, descripcion: null, tags: null, orden: 0,
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  carrito.cantidadDe.mockReturnValue(0);
  carrito.cantidadTotalDe.mockReturnValue(0);
});

describe('AgregarControl (pagina) — selector talle×tipo con filtrado mutuo', () => {
  it('arranca sin nada elegido: pide elegir talle y tipo/color, sin mostrar precio', () => {
    render(<AgregarControl producto={producto()} variante="pagina" />);
    expect(screen.getByText('Elegí talle y tipo/color para ver precio y agregar.')).toBeInTheDocument();
    expect(screen.queryByText(/1\.000/)).not.toBeInTheDocument();
  });

  it('una variante inactiva (Grande×Azul) nunca aparece como opción alcanzable', async () => {
    const user = userEvent.setup();
    render(<AgregarControl producto={producto()} variante="pagina" />);

    await user.click(screen.getByRole('button', { name: 'Grande' }));
    // Con Grande elegido, sólo Rojo es alcanzable en tipo — Azul (inactivo
    // para Grande) queda marcado como no alcanzable (aria-disabled, no
    // `disabled` de verdad: sigue siendo clickeable, ver el comentario de
    // SelectorEje sobre por qué no se bloquea el click).
    expect(screen.getByRole('button', { name: 'Azul' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Rojo' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('elegir un tipo primero acota los talles disponibles al revés', async () => {
    const user = userEvent.setup();
    render(<AgregarControl producto={producto()} variante="pagina" />);

    await user.click(screen.getByRole('button', { name: 'Azul' }));
    // Azul sólo existe activo para Chico (Grande×Azul está inactiva).
    expect(screen.getByRole('button', { name: 'Grande' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Chico' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('completar la combinación muestra precio y stepper, con el código correcto', async () => {
    const user = userEvent.setup();
    render(<AgregarControl producto={producto()} variante="pagina" />);

    await user.click(screen.getByRole('button', { name: 'Chico' }));
    await user.click(screen.getByRole('button', { name: 'Rojo' }));

    expect(await screen.findByText(/1\.000/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Agregar uno' }));
    expect(carrito.setCantidad).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CR', variant: 'Chico · Rojo' }),
      1
    );
  });

  it('sin stock: se muestra junto al precio de esa combinación puntual', async () => {
    const user = userEvent.setup();
    render(<AgregarControl producto={producto()} variante="pagina" />);

    await user.click(screen.getByRole('button', { name: 'Grande' }));
    await user.click(screen.getByRole('button', { name: 'Rojo' }));

    expect(await screen.findByText(/Sin stock/)).toBeInTheDocument();
  });

  it('pocas unidades: se muestra cuando corresponde a esa combinación', async () => {
    const user = userEvent.setup();
    render(<AgregarControl producto={producto()} variante="pagina" />);

    await user.click(screen.getByRole('button', { name: 'Chico' }));
    await user.click(screen.getByRole('button', { name: 'Azul' }));

    expect(await screen.findByText(/Quedan pocas unidades/)).toBeInTheDocument();
  });

  it('sin precio conocido todavía para el código, "Consultar precio" en vez de inventar un número', async () => {
    const user = userEvent.setup();
    render(<AgregarControl producto={producto()} variante="pagina" />);

    await user.click(screen.getByRole('button', { name: 'Chico' }));
    await user.click(screen.getByRole('button', { name: 'Verde' })); // CV: sin precio en el mapa mockeado

    expect(await screen.findByText('Consultar precio')).toBeInTheDocument();
  });

  it('completar la combinación avisa la imagen propia de esa variante vía onCambiarImagen', async () => {
    const user = userEvent.setup();
    const onCambiarImagen = vi.fn();
    render(<AgregarControl producto={producto()} variante="pagina" onCambiarImagen={onCambiarImagen} />);

    await user.click(screen.getByRole('button', { name: 'Chico' }));
    await user.click(screen.getByRole('button', { name: 'Rojo' }));

    expect(onCambiarImagen).toHaveBeenCalledWith('https://cdn/chico-rojo.webp');
  });

  it('una combinación sin imagen propia avisa null (vuelve a la galería general)', async () => {
    const user = userEvent.setup();
    const onCambiarImagen = vi.fn();
    render(<AgregarControl producto={producto()} variante="pagina" onCambiarImagen={onCambiarImagen} />);

    await user.click(screen.getByRole('button', { name: 'Chico' }));
    await user.click(screen.getByRole('button', { name: 'Azul' })); // CA no tiene `imagen`

    expect(onCambiarImagen).toHaveBeenLastCalledWith(null);
  });

  it('elegir un valor que invalida la elección previa del otro eje la resetea, sin dejar una combinación fantasma', async () => {
    const user = userEvent.setup();
    render(<AgregarControl producto={producto()} variante="pagina" />);

    await user.click(screen.getByRole('button', { name: 'Chico' }));
    await user.click(screen.getByRole('button', { name: 'Azul' }));
    expect(await screen.findByText(/1\.200/)).toBeInTheDocument(); // Chico×Azul resuelto

    // Cambiar a Grande invalida Azul (Grande×Azul está inactiva) — vuelve a pedir tipo/color.
    await user.click(screen.getByRole('button', { name: 'Grande' }));
    expect(screen.getByText('Elegí tipo/color para ver precio y agregar.')).toBeInTheDocument();
  });
});

describe('AgregarControl (pagina) — un solo eje (todos los productos reales hoy)', () => {
  const SOLO_TALLES = [
    { talle: 'Collar', codigo: 'V1', activo: true },
    { talle: 'Vincha x 12', codigo: 'V2', activo: true }
  ];

  it('sigue mostrando la lista plana de siempre, sin selector de dos pasos', () => {
    render(<AgregarControl producto={producto({ variantes: SOLO_TALLES })} variante="pagina" />);
    expect(screen.getByText('Elegí un talle:')).toBeInTheDocument();
    expect(screen.getByText('Collar')).toBeInTheDocument();
    expect(screen.getByText('Vincha x 12')).toBeInTheDocument();
  });

  it('cada fila ya tiene su propio stepper, sin paso de "elegir primero"', async () => {
    const user = userEvent.setup();
    render(<AgregarControl producto={producto({ variantes: SOLO_TALLES })} variante="pagina" />);

    const masBotones = screen.getAllByRole('button', { name: 'Agregar uno' });
    await user.click(masBotones[0]);

    expect(carrito.setCantidad).toHaveBeenCalledWith(expect.objectContaining({ code: 'V1', variant: 'Collar' }), 1);
  });
});
