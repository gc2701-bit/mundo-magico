/* app/admin/metricas/page.tsx — Sprint B del dashboard admin: tarjetas
 * con los 5 conteos reales de catalogo_metricas_admin() (ver
 * supabase/catalogo_21_metricas_admin.sql).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AdminMetricasPage from '../../app/admin/metricas/page';

const rpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabaseBrowser: () => ({ rpc }),
}));

afterEach(() => {
  cleanup();
  rpc.mockReset();
});

describe('AdminMetricasPage', () => {
  it('muestra los 5 números reales devueltos por catalogo_metricas_admin()', async () => {
    rpc.mockResolvedValue({
      data: { publicados: 385, sinFamilia: 83, sinStock: 12, pocasUnidades: 7, esperandoActivar: 4199 },
      error: null,
    });

    render(<AdminMetricasPage />);

    expect(await screen.findByText('385')).toBeInTheDocument();
    expect(screen.getByText('83')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('4199')).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('catalogo_metricas_admin');
  });

  it('si la RPC falla, muestra un mensaje de error en vez de quedarse cargando', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    render(<AdminMetricasPage />);

    expect(await screen.findByText(/no se pudieron cargar las métricas/i)).toBeInTheDocument();
  });
});
