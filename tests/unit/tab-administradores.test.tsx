/* app/components/admin/TabAdministradores.tsx — Sprint D del dashboard
 * admin. public.admins hoy sólo tiene una policy de SELECT-a-sí-mismo
 * (ver supabase/usuarios_00_admin_clientes.sql): agregar/quitar pasa
 * siempre por las RPCs admin_buscar_usuario_por_email/admin_agregar/
 * admin_quitar, nunca por un insert/delete directo del cliente.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabAdministradores from '../../app/components/admin/TabAdministradores';

const rpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabaseBrowser: () => ({ rpc }),
}));

afterEach(() => {
  cleanup();
  rpc.mockReset();
});

describe('TabAdministradores', () => {
  it('lista los admins actuales por email', async () => {
    rpc.mockResolvedValueOnce({ data: [{ user_id: 'u1', email: 'a@a.com' }], error: null });
    render(<TabAdministradores />);

    expect(await screen.findByText('a@a.com')).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('admin_listar_admins');
  });

  it('agregar un email con cuenta real lo suma a la lista', async () => {
    const user = userEvent.setup();
    rpc
      .mockResolvedValueOnce({ data: [], error: null }) // listar inicial
      .mockResolvedValueOnce({ data: [{ id: 'u2', email: 'nuevo@a.com' }], error: null }) // buscar
      .mockResolvedValueOnce({ data: null, error: null }) // agregar
      .mockResolvedValueOnce({ data: [{ user_id: 'u2', email: 'nuevo@a.com' }], error: null }); // listar de nuevo

    render(<TabAdministradores />);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText(/agregar por email/i), 'nuevo@a.com');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByText('nuevo@a.com')).toBeInTheDocument();
    expect(rpc).toHaveBeenNthCalledWith(2, 'admin_buscar_usuario_por_email', { p_email: 'nuevo@a.com' });
    expect(rpc).toHaveBeenNthCalledWith(3, 'admin_agregar', { p_user_id: 'u2' });
  });

  it('buscar un email sin cuenta muestra "no existe una cuenta con ese email"', async () => {
    const user = userEvent.setup();
    rpc
      .mockResolvedValueOnce({ data: [], error: null }) // listar inicial
      .mockResolvedValueOnce({ data: [], error: null }); // buscar: nada

    render(<TabAdministradores />);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText(/agregar por email/i), 'nadie@a.com');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByText(/no existe una cuenta con ese email/i)).toBeInTheDocument();
  });

  it('intentar quitar al último admin muestra el error sin romper la UI', async () => {
    const user = userEvent.setup();
    rpc
      .mockResolvedValueOnce({ data: [{ user_id: 'u1', email: 'unico@a.com' }], error: null }) // listar
      .mockResolvedValueOnce({ data: null, error: { message: 'No se puede quitar al último administrador' } }); // quitar

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TabAdministradores />);
    await screen.findByText('unico@a.com');

    await user.click(screen.getByRole('button', { name: 'Quitar' }));

    expect(await screen.findByText(/no se puede quitar al último administrador/i)).toBeInTheDocument();
    expect(screen.getByText('unico@a.com')).toBeInTheDocument();
  });
});
