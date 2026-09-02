/* app/admin/carritos/page.tsx — Sprint E del dashboard admin: resumen
 * completados vs abandonados + lista de carritos abandonados.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AdminCarritosPage from '../../app/admin/carritos/page';

const rpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabaseBrowser: () => ({ rpc }),
}));

afterEach(() => {
  cleanup();
  rpc.mockReset();
});

describe('AdminCarritosPage', () => {
  it('separa completados de abandonados y muestra los últimos ítems de cada abandonado', async () => {
    const ahora = new Date();
    const hace49hs = new Date(ahora.getTime() - 49 * 3600000).toISOString();
    const hace1hs = new Date(ahora.getTime() - 1 * 3600000).toISOString();

    rpc.mockResolvedValue({
      data: [
        { user_id: 'u1', email: 'completo@a.com', ultimo_evento: hace49hs, completado: true, ultimos_items: [] },
        { user_id: 'u2', email: 'abandonado@a.com', ultimo_evento: hace49hs, completado: false, ultimos_items: [{ tipo: 'agregado', titulo: 'Globo', variante: null, cantidad: 2 }] },
        { user_id: 'u3', email: 'encurso@a.com', ultimo_evento: hace1hs, completado: false, ultimos_items: [] },
      ],
      error: null,
    });

    render(<AdminCarritosPage />);

    await screen.findByText('abandonado@a.com');
    expect(screen.getByTestId('carritos-completados')).toHaveTextContent('1');
    expect(screen.getByTestId('carritos-abandonados')).toHaveTextContent('1');
    expect(screen.getByText('abandonado@a.com')).toBeInTheDocument();
    expect(screen.getByText(/Globo/)).toBeInTheDocument();
    expect(screen.queryByText('completo@a.com')).not.toBeInTheDocument();
    expect(screen.queryByText('encurso@a.com')).not.toBeInTheDocument();
  });
});
