/* app/components/EmptyState.tsx — Sprint 3 del rediseño de frontend.
 * Regla del diseño aprobado: ningún estado vacío queda sin texto ni
 * salida.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from '../../app/components/EmptyState';

describe('EmptyState', () => {
  it('sin accion: muestra título y descripción, sin botón', () => {
    render(<EmptyState titulo="Sin resultados" descripcion="Probá otra palabra" />);
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    expect(screen.getByText('Probá otra palabra')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('con accion: el botón linkea a donde corresponde', () => {
    render(<EmptyState titulo="Mundo sin productos" accion={{ label: 'Ver otros mundos', href: '/explorar' }} />);
    expect(screen.getByRole('link', { name: 'Ver otros mundos' })).toHaveAttribute('href', '/explorar');
  });

  it('siempre tiene un ícono, aunque sea el default', () => {
    render(<EmptyState titulo="Algo" />);
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
