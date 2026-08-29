/* app/components/HeroCarrusel.tsx — bug real reportado: los precios del
 * carrusel quedaban pegados al del primer destacado al cambiar de
 * producto (CatalogoPrecios.tsx hidrata el DOM una sola vez al montar,
 * pero el carrusel reusa el mismo nodo .pricetag para todos los
 * destacados). Cubre que el precio se recalcule con React state en cada
 * cambio de índice, en vez de depender de esa hidratación imperativa.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import HeroCarrusel from '../../app/components/HeroCarrusel';

vi.mock('../../lib/catalogo-precios-publico', () => ({
  obtenerPreciosPublicos: () =>
    Promise.resolve({
      precios: { '111': 9500, '222': 15000 },
      sinStock: {},
      pocasUnidades: {},
    }),
}));

const base = {
  id: '1',
  mundo: 'globos-fiesta',
  subcategoriaId: null,
  slug: 'producto',
  specs: null,
  descripcion: null,
  tags: null,
  variantes: null,
  orden: 0,
  familia: null,
};

const productos = [
  { ...base, id: '1', titulo: 'Producto uno', slug: 'uno', codigo: '111', fotos: [] },
  { ...base, id: '2', titulo: 'Producto dos', slug: 'dos', codigo: '222', fotos: [] },
];

function precioMostrado() {
  return document.querySelector('.pricetag')?.textContent?.replace(/\s/g, ' ').trim();
}

describe('HeroCarrusel — precio', () => {
  it('al pasar al siguiente destacado, muestra SU precio (no el del anterior)', async () => {
    render(<HeroCarrusel productos={productos} />);

    // deja resolver el fetch de precios (obtenerPreciosPublicos)
    await act(async () => {
      await Promise.resolve();
    });
    expect(precioMostrado()).toBe('$ 9.500');

    await act(async () => {
      screen.getByRole('button', { name: 'Destacado siguiente' }).click();
      await new Promise((r) => setTimeout(r, 250));
    });

    expect(precioMostrado()).toBe('$ 15.000');
  });
});
