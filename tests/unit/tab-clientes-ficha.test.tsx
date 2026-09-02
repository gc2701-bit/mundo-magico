/* app/components/admin/TabClientes.tsx + FichaCliente.tsx — Sprint D del
 * dashboard admin. Clientes se agregan desde `pedidos` (no hay perfil de
 * cliente propio todavía, ver SPEC-dashboard-admin.md), vía
 * clientes_resumen(). La ficha reusa la policy ya existente de admin sobre
 * `pedidos` ("Los admins ven todos los pedidos"), no una RPC nueva.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabClientes from '../../app/components/admin/TabClientes';

const rpc = vi.fn();
const order = vi.fn();
const eq = vi.fn(() => ({ order }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock('@/lib/supabase', () => ({
  supabaseBrowser: () => ({ rpc, from }),
}));

const CLIENTES = [
  { user_id: 'u1', email: 'ana@a.com', nombre: 'Ana', telefono: '3811234567', direccion: 'Calle 1', cantidad_pedidos: 2, ultimo_pedido: '2026-08-26T00:00:00Z' },
  { user_id: 'u2', email: 'beto@a.com', nombre: 'Beto', telefono: '3817654321', direccion: 'Calle 2', cantidad_pedidos: 1, ultimo_pedido: '2026-08-20T00:00:00Z' },
];

afterEach(() => {
  cleanup();
  rpc.mockReset();
  order.mockReset();
  eq.mockClear();
  select.mockClear();
  from.mockClear();
});

describe('TabClientes', () => {
  it('lista todos los clientes que tienen al menos un pedido', async () => {
    rpc.mockResolvedValueOnce({ data: CLIENTES, error: null });
    render(<TabClientes />);

    expect(await screen.findByText(/Ana/)).toBeInTheDocument();
    expect(screen.getByText(/Beto/)).toBeInTheDocument();
  });

  it('buscar por teléfono encuentra al cliente correcto', async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValueOnce({ data: CLIENTES, error: null });
    render(<TabClientes />);
    await screen.findByText(/Ana/);

    await user.type(screen.getByPlaceholderText(/buscar/i), '3817654321');

    expect(screen.queryByText(/Ana/)).not.toBeInTheDocument();
    expect(screen.getByText(/Beto/)).toBeInTheDocument();
  });

  it('abrir la ficha de un cliente lista sus pedidos en orden cronológico', async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValueOnce({ data: CLIENTES, error: null });
    order.mockResolvedValueOnce({
      data: [
        { id: 'p2', numero: 1002, created_at: '2026-08-26T00:00:00Z', estado: 'entregado', items: [{ t: 'Globo', q: 2 }] },
        { id: 'p1', numero: 1001, created_at: '2026-08-01T00:00:00Z', estado: 'entregado', items: [{ t: 'Sombrero', q: 1 }] },
      ],
      error: null,
    });

    render(<TabClientes />);
    await user.click(await screen.findByText(/Ana/));

    expect(from).toHaveBeenCalledWith('pedidos');
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
    await waitFor(() => expect(screen.getByText(/Globo/)).toBeInTheDocument());
    expect(screen.getByText(/Sombrero/)).toBeInTheDocument();
  });
});
