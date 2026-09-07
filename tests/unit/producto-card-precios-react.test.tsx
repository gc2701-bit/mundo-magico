/* Bug real reportado por el usuario (2026-09-07): en /explorar (y en una
 * página de mundo) el precio no se veía al buscar/filtrar/paginar, sólo
 * al entrar a la ficha de producto. Causa raíz: CatalogoPrecios.tsx
 * hidrata el DOM una sola vez al montar la página — MundoContenido.tsx
 * reemplaza las tarjetas después (buscar/filtrar/"Cargar más") y esas
 * tarjetas nuevas nunca se hidrataban.
 *
 * Fix: cuando ProductoCard recibe `precios` (MundoContenido.tsx), resuelve
 * precio/oferta/stock por React en cada render, sin depender del DOM ni
 * de un efecto de una sola vez. Este test simula exactamente ese
 * escenario: una tarjeta que aparece DESPUÉS del primer render (como pasa
 * con los resultados nuevos de una búsqueda), con `precios` ya resuelto
 * desde antes — nunca remontando el árbol.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductoCard from '../../app/components/ProductoCard';
import type { PreciosPublico } from '../../lib/catalogo-precios-publico';

vi.mock('../../app/components/carrito/AccionesProducto', () => ({
  FavoritoBoton: () => null,
  AgregarControl: () => null,
}));

const base = {
  id: '1',
  mundo: 'globos-fiesta',
  subcategoriaId: null,
  titulo: 'Anteojo estrella',
  slug: 'anteojo-estrella',
  codigo: '61147',
  specs: null,
  descripcion: null,
  tags: null,
  variantes: null,
  fotos: [{ src: 'productos/anteojo.jpeg', cap: '' }],
  orden: 0,
  familia: null,
};

const precios: PreciosPublico = {
  precios: { '61147': 9500, '99999': 15000 },
  sinStock: {},
  pocasUnidades: {},
};

function pricetagTexto() {
  return document.querySelector('.pricetag')?.textContent?.replace(/\s/g, ' ').trim();
}

describe('ProductoCard — precio resuelto por React (con `precios`)', () => {
  it('muestra el precio ya en el primer render, sin esperar ningún efecto ni hidratación DOM', () => {
    render(<ProductoCard producto={base} precios={precios} />);
    expect(pricetagTexto()).toBe('$ 9.500');
  });

  it('una tarjeta que aparece DESPUÉS del mount inicial (re-render, no remount) también muestra su precio', () => {
    // Arranca sin `precios` (como el primer paint de MundoContenido, antes
    // de que resuelva obtenerPreciosPublicos()) — nunca se monta de cero
    // con `precios` ya listo, para reproducir el timing real del bug.
    const { rerender } = render(<ProductoCard producto={base} />);
    expect(pricetagTexto()).toBe('');

    // Simula: (1) el fetch de precios resuelve, y (2) al mismo tiempo la
    // búsqueda trae un producto DISTINTO (otra tarjeta) — exactamente lo
    // que hace MundoContenido en un solo re-render, sin desmontar nada.
    const otroProducto = { ...base, id: '2', codigo: '99999', titulo: 'Otro producto', slug: 'otro' };
    rerender(<ProductoCard producto={otroProducto} precios={precios} />);

    expect(pricetagTexto()).toBe('$ 15.000');
  });

  it('producto con variantes: "Desde $X" con el mínimo de las activas, resuelto por React', () => {
    const conVariantes = {
      ...base,
      codigo: null,
      variantes: [
        { talle: 'Chico', codigo: '61147', activo: true },
        { talle: 'Grande', codigo: '99999', activo: true },
      ],
    };
    render(<ProductoCard producto={conVariantes} precios={precios} />);
    expect(pricetagTexto()).toBe('Desde $ 9.500');
  });

  it('sin stock: badge "Sin stock" y data-agotado, resueltos por React', () => {
    const sinStockMapa: PreciosPublico = { ...precios, sinStock: { '61147': true } };
    render(<ProductoCard producto={base} precios={sinStockMapa} />);
    expect(screen.getByText('Sin stock')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('data-agotado', '1');
  });
});
