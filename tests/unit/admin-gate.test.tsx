/* app/components/admin/AdminGate.tsx — gate único para todo /admin/*
 * (Sprint A del dashboard admin, ver tasks/plan-dashboard-admin.md).
 *
 * Antes había 3 gates distintos, uno por sección: éste (con su propio
 * mini-login + Turnstile), y los de pedidos/envíos (que ya reusaban
 * useCuenta()). Este test reemplaza al viejo (que probaba el login con
 * Turnstile y la clase .adm-wrap-catalogo, ambos movidos/eliminados en
 * este sprint) por el comportamiento genérico compartido: sin sesión,
 * sesión sin permisos, y sesión admin.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AdminGate from '../../app/components/admin/AdminGate';

const pedirSesion = vi.fn();

vi.mock('@/app/components/cuenta/CuentaProvider', () => ({
  useCuenta: () => mockUseCuenta(),
}));

let mockUseCuenta: () => {
  sesion: unknown;
  cargandoSesion: boolean;
  esAdmin: boolean;
  pedirSesion: typeof pedirSesion;
};

afterEach(() => {
  cleanup();
  pedirSesion.mockClear();
});

describe('AdminGate', () => {
  it('mientras carga la sesión, no muestra nada (ni gate ni contenido)', () => {
    mockUseCuenta = () => ({ sesion: null, cargandoSesion: true, esAdmin: false, pedirSesion });
    const { container } = render(<AdminGate><p>contenido</p></AdminGate>);
    expect(container).toBeEmptyDOMElement();
  });

  it('sin sesión: muestra el gate con botón "Iniciar sesión" que abre el modal de cuenta', async () => {
    mockUseCuenta = () => ({ sesion: null, cargandoSesion: false, esAdmin: false, pedirSesion });
    render(<AdminGate><p>contenido</p></AdminGate>);

    expect(screen.getByText(/Necesitás iniciar sesión/i)).toBeInTheDocument();
    expect(screen.queryByText('contenido')).not.toBeInTheDocument();

    screen.getByRole('button', { name: 'Iniciar sesión' }).click();
    expect(pedirSesion).toHaveBeenCalledWith(undefined, 'login');
  });

  it('con sesión pero sin permisos de admin: muestra "no autorizado", nunca el contenido', () => {
    mockUseCuenta = () => ({ sesion: { user: { id: 'u1' } }, cargandoSesion: false, esAdmin: false, pedirSesion });
    render(<AdminGate><p>contenido</p></AdminGate>);

    expect(screen.getByText(/no tiene permisos de administrador/i)).toBeInTheDocument();
    expect(screen.queryByText('contenido')).not.toBeInTheDocument();
  });

  it('con sesión admin: renderiza el contenido, sin envoltorio propio ni botón de logout duplicado', () => {
    mockUseCuenta = () => ({ sesion: { user: { id: 'u1' } }, cargandoSesion: false, esAdmin: true, pedirSesion });
    render(<AdminGate><p>contenido</p></AdminGate>);

    expect(screen.getByText('contenido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cerrar sesión/i })).not.toBeInTheDocument();
  });
});
