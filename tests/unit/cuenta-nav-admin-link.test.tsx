/* app/components/cuenta/CuentaNavButton.tsx — el link de admin en el
 * desplegable de cuenta pasa a apuntar al dashboard (/admin) en vez de
 * directo a /admin/catalogo (Sprint A del dashboard admin) — un solo
 * punto de entrada, desde el cual se navega a cada sección.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CuentaNavButton from '../../app/components/cuenta/CuentaNavButton';

const SESION_FALSA = { user: { id: 'u1', email: 'ana@example.com', user_metadata: { nombre: 'Ana' } } };

let esAdmin = false;

vi.mock('@/app/components/cuenta/CuentaProvider', () => ({
  useCuenta: () => ({
    sesion: SESION_FALSA,
    esAdmin,
    pedirSesion: vi.fn(),
    abrirAjustes: vi.fn(),
    abrirFavoritos: vi.fn(),
    cerrarSesion: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  esAdmin = false;
});

describe('CuentaNavButton — link al dashboard admin', () => {
  it('cuenta admin: el desplegable muestra "Dashboard" apuntando a /admin', async () => {
    esAdmin = true;
    const user = userEvent.setup();
    render(<CuentaNavButton />);

    await user.click(screen.getByRole('button', { name: 'Mi cuenta' }));

    const link = screen.getByRole('menuitem', { name: 'Dashboard' });
    expect(link).toHaveAttribute('href', '/admin');
  });

  it('cuenta no admin: no muestra ningún link de administración', async () => {
    esAdmin = false;
    const user = userEvent.setup();
    render(<CuentaNavButton />);

    await user.click(screen.getByRole('button', { name: 'Mi cuenta' }));

    expect(screen.queryByRole('menuitem', { name: 'Dashboard' })).not.toBeInTheDocument();
  });
});
