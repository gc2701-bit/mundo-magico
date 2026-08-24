/* app/components/ProductoCard.tsx — rediseño Sprint 3 (ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md).
 * Cubre lo que se resuelve en el server (placeholder sin foto, badge
 * "Nuevo", etiqueta de familia, data-precio-oferta) — la hidratación de
 * precio/oferta real vía CatalogoPrecios.tsx (fetch + DOM) está cubierta
 * aparte en tests/unit/precios-familia.test.js (resolverOferta) y
 * verificada visualmente contra el proyecto real.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductoCard from '../../app/components/ProductoCard';

// FavoritoBoton/AgregarControl necesitan <CuentaProvider>/<CarritoProvider>
// (contexto con llamadas a Supabase) — no es lo que este archivo prueba
// (eso ya está cubierto por carrito.spec.js/carrito-next.test.js). Se
// stubean para poder montar ProductoCard aislado.
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
  talles: null,
  fotos: [{ src: 'productos/anteojo.jpeg', cap: '' }],
  orden: 0,
  familia: null,
};

describe('ProductoCard', () => {
  it('sin foto curada: muestra el placeholder de marca, nunca un hueco vacío', () => {
    render(<ProductoCard producto={{ ...base, fotos: [] }} />);
    expect(screen.getByAltText('')).toBeInTheDocument(); // el logo, alt="" a propósito (decorativo)
    expect(screen.queryByRole('img', { name: 'Anteojo estrella' })).not.toBeInTheDocument();
  });

  it('con foto: la muestra en vez del placeholder', () => {
    render(<ProductoCard producto={base} />);
    expect(screen.getByAltText('Anteojo estrella')).toBeInTheDocument();
  });

  it('con familia: muestra la etiqueta arriba del título', () => {
    render(<ProductoCard producto={{ ...base, familia: 'ANTEOJOS ESPECIAL' }} />);
    expect(screen.getByText('ANTEOJOS ESPECIAL')).toBeInTheDocument();
  });

  it('sin familia: no muestra una etiqueta vacía', () => {
    render(<ProductoCard producto={base} />);
    expect(screen.queryByText('', { selector: '.uppercase' })).not.toBeInTheDocument();
  });

  it('nuevo=true: el badge "Nuevo" se renderiza visible desde el server', () => {
    render(<ProductoCard producto={base} nuevo />);
    const badge = screen.getByText('Nuevo');
    expect(badge).toHaveAttribute('data-badge-tipo', 'nuevo');
  });

  it('sin nuevo/oferta/sin-stock: el badge existe pero arranca oculto (lo prende CatalogoPrecios si corresponde)', () => {
    render(<ProductoCard producto={base} />);
    const badge = document.querySelector('[data-badge]');
    expect(badge).not.toBeNull();
    expect(badge).toHaveClass('hidden');
  });

  it('precioOferta: manda data-precio-oferta para que CatalogoPrecios.tsx lo hidrate', () => {
    render(<ProductoCard producto={base} precioOferta={4500} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('data-precio-oferta', '4500');
  });

  it('sin precioOferta: no manda el atributo', () => {
    render(<ProductoCard producto={base} />);
    const link = screen.getByRole('link');
    expect(link).not.toHaveAttribute('data-precio-oferta');
  });
});
