/* app/admin/analiticas/page.tsx — Sprint F del dashboard admin: gráfico
 * de visitas por día + ranking de artículos más consultados.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AdminAnaliticasPage from '../../app/admin/analiticas/page';

const rpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabaseBrowser: () => ({ rpc }),
}));

afterEach(() => {
  cleanup();
  rpc.mockReset();
});

describe('AdminAnaliticasPage', () => {
  it('pide visitas por día y ranking con los parámetros esperados, y pinta el ranking con nombre real', async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === 'analytics_visitas_por_dia') {
        return Promise.resolve({ data: [{ fecha: '2026-09-01', visitas: 5 }, { fecha: '2026-09-02', visitas: 8 }], error: null });
      }
      if (fn === 'analytics_ranking_productos') {
        return Promise.resolve({
          data: [{ ruta: '/globos-fiesta/abanico-luminoso', vistas: 12, titulo: 'ABANICO LUMINOSO', mundo: 'globos-fiesta', slug: 'abanico-luminoso' }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<AdminAnaliticasPage />);

    expect(await screen.findByText(/ABANICO LUMINOSO/)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('analytics_visitas_por_dia', { p_dias: 30 });
    expect(rpc).toHaveBeenCalledWith('analytics_ranking_productos', { p_dias: 30, p_limite: 20 });
  });

  it('sin datos todavía: muestra los mensajes de "todavía no hay" en vez de romper', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    render(<AdminAnaliticasPage />);

    expect(await screen.findByText(/todavía no hay visitas registradas/i)).toBeInTheDocument();
    expect(screen.getByText(/todavía no hay vistas de producto registradas/i)).toBeInTheDocument();
  });
});
