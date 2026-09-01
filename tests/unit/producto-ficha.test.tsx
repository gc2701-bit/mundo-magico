/* app/components/ProductoFicha.tsx — feature: mostrar todas las fotos de
 * variantes en el carrusel general (antes: producto.fotos vacía + variante
 * de un solo eje elegible => portada quedaba en el logo genérico siempre,
 * ver tasks/plan-imagenes-productos.md, Sprint 1).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductoFicha from '../../app/components/ProductoFicha';

// FavoritoBoton/AgregarControl necesitan <CuentaProvider>/<CarritoProvider>
// (contexto con llamadas a Supabase) — no es lo que este archivo prueba
// (mismo criterio que tests/unit/producto-card.test.tsx).
vi.mock('../../app/components/carrito/AccionesProducto', () => ({
  FavoritoBoton: () => null,
  AgregarControl: () => null
}));

// ComboComposicion pide combo_composicion() a Supabase — no es lo que este
// archivo prueba, se stubea para que no reste nada.
vi.mock('../../lib/combo-composicion', () => ({
  obtenerComposicionCombo: vi.fn().mockResolvedValue([])
}));

const base = {
  id: '1',
  mundo: 'cumpleanos',
  subcategoriaId: null,
  titulo: 'Bolsas de papel',
  slug: 'bolsas-de-papel',
  codigo: null,
  specs: null,
  descripcion: null,
  tags: null,
  variantes: null,
  fotos: [],
  orden: 0,
  familia: null
};

describe('ProductoFicha — el carrusel muestra todas las fotos de variantes activas con imagen propia', () => {
  it('sin fotos generales, con variantes de un solo eje con imagen: la portada NO es el logo genérico, es la primera foto de variante', () => {
    render(
      <ProductoFicha
        producto={{
          ...base,
          variantes: [
            { tipo: 'Rojo', codigo: 'R1', imagen: 'https://x.supabase.co/rojo.webp', activo: true },
            { tipo: 'Azul', codigo: 'A1', imagen: 'https://x.supabase.co/azul.webp', activo: true }
          ]
        }}
      />
    );

    const portada = screen.getByAltText('Bolsas de papel · Rojo');
    expect(portada).toHaveAttribute('src', 'https://x.supabase.co/rojo.webp');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('variante sacada de la venta (activo:false) no aporta foto al carrusel', () => {
    render(
      <ProductoFicha
        producto={{
          ...base,
          variantes: [
            { tipo: 'Rojo', codigo: 'R1', imagen: 'https://x.supabase.co/rojo.webp', activo: true },
            { tipo: 'Azul', codigo: 'A1', imagen: 'https://x.supabase.co/azul.webp', activo: false }
          ]
        }}
      />
    );

    expect(screen.queryAllByRole('tab')).toHaveLength(0); // 1 sola foto -> sin tira de miniaturas
    expect(screen.getByAltText('Bolsas de papel · Rojo')).toBeInTheDocument();
  });

  it('fotos generales + fotos de variantes se combinan (generales primero)', () => {
    render(
      <ProductoFicha
        producto={{
          ...base,
          fotos: [{ src: 'productos/general.jpg', cap: '' }],
          variantes: [{ tipo: 'Rojo', codigo: 'R1', imagen: 'https://x.supabase.co/rojo.webp', activo: true }]
        }}
      />
    );

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByAltText('Bolsas de papel')).toHaveAttribute('src', '/productos/general.jpg');
  });
});
