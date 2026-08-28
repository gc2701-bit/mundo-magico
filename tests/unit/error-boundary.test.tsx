/* app/error.tsx — Sprint 1 del fix de tasks/plan.md (2026-08-28): red de
 * contención para que una excepción no capturada durante un render/ISR
 * (ej. obtenerCatalogoPublico() tirando) caiga en una página de error
 * reintentable en vez de arriesgarse a quedar cacheada como 404.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '../../app/error';

describe('app/error.tsx', () => {
  it('muestra un mensaje de error genérico, no el mensaje técnico crudo', () => {
    const error = Object.assign(new Error('fetch failed: ECONNRESET'), { digest: 'abc123' });
    render(<ErrorBoundary error={error} reset={() => {}} />);

    expect(screen.getByText(/algo sali[oó] mal/i)).toBeInTheDocument();
    expect(screen.queryByText(/ECONNRESET/)).not.toBeInTheDocument();
  });

  it('el botón de reintentar llama a reset()', async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<ErrorBoundary error={new Error('boom')} reset={reset} />);

    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
