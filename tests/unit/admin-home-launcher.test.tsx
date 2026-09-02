/* app/components/admin/AdminHomeLauncher.tsx — grid de tiles del home de
 * /admin (Sprint A del dashboard admin). Patrón adaptado de HomeLauncher
 * de whatsapp-agent: ícono + título + descripción + link, sin
 * "Próximamente" — las 6 secciones quedan activas desde este sprint (ver
 * tasks/plan-dashboard-admin.md).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AdminHomeLauncher from '../../app/components/admin/AdminHomeLauncher';

afterEach(cleanup);

describe('AdminHomeLauncher', () => {
  it('muestra los 6 tiles del dashboard, cada uno con su link activo', () => {
    render(<AdminHomeLauncher />);

    const esperados: Record<string, string> = {
      'Catálogo': '/admin/catalogo',
      'Pedidos': '/admin/pedidos',
      'Métricas de catálogo': '/admin/metricas',
      'Usuarios': '/admin/usuarios',
      'Carritos': '/admin/carritos',
      'Analíticas': '/admin/analiticas',
    };

    Object.entries(esperados).forEach(([label, href]) => {
      const link = screen.getByRole('link', { name: new RegExp(label) });
      expect(link).toHaveAttribute('href', href);
    });
  });

  it('el grid usa una sola columna en mobile (mobile-first)', () => {
    render(<AdminHomeLauncher />);
    const grid = screen.getByTestId('admin-home-grid');
    expect(grid.className).toMatch(/grid-cols-1/);
  });
});
