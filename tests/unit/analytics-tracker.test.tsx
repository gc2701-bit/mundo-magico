/* app/components/AnalyticsTracker.tsx — Sprint F del dashboard admin.
 * Detecta ficha de producto por FORMA de la ruta (2 segmentos, ej.
 * "/globos-fiesta/abanico-luminoso") en vez de instrumentar cada página a
 * mano: es exactamente la forma de la ruta [mundo]/[slug], y ninguna otra
 * ruta del sitio tiene 2 segmentos salvo /admin/* (excluida a propósito:
 * no tiene sentido medir la navegación del propio staff como "visita").
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import AnalyticsTracker from '../../app/components/AnalyticsTracker';

const { registrarVisita } = vi.hoisted(() => ({ registrarVisita: vi.fn() }));
vi.mock('@/lib/analytics-tracking', () => ({ registrarVisita }));

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

const { sesion } = vi.hoisted(() => ({ sesion: null as { user: { id: string } } | null }));
vi.mock('@/app/components/cuenta/CuentaProvider', () => ({ useCuenta: () => ({ sesion, sb: {} }) }));

afterEach(() => {
  cleanup();
  registrarVisita.mockReset();
  pathname = '/';
});

describe('AnalyticsTracker', () => {
  it('ruta de un segmento: registra un pageview, no un producto', () => {
    pathname = '/carrito';
    render(<AnalyticsTracker />);
    expect(registrarVisita).toHaveBeenCalledWith(expect.anything(), '/carrito', { producto: false, userId: null });
  });

  it('ruta de 2 segmentos (ficha de producto): registra vista_producto', () => {
    pathname = '/globos-fiesta/abanico-luminoso';
    render(<AnalyticsTracker />);
    expect(registrarVisita).toHaveBeenCalledWith(expect.anything(), '/globos-fiesta/abanico-luminoso', { producto: true, userId: null });
  });

  it('rutas de /admin/* nunca se registran, aunque tengan 2 segmentos', () => {
    pathname = '/admin/catalogo';
    render(<AnalyticsTracker />);
    expect(registrarVisita).not.toHaveBeenCalled();
  });
});
