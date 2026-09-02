/* app/components/admin-pedidos/PedidoCard.tsx — precio en vivo por ítem
 * (Sprint C del dashboard admin). La lógica pura ya está cubierta en
 * tests/unit/pedido-card-precio.test.tsx; esto verifica la integración:
 * que la tarjeta llama catalogo_precios_admin() con los códigos del
 * pedido y pinta precio/total con los datos que vuelven.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import PedidoCard from '../../app/components/admin-pedidos/PedidoCard';
import type { Pedido } from '../../lib/pedidos-admin';

afterEach(cleanup);

function pedidoBase(items: Pedido['items']): Pedido {
  return {
    id: 'p1', user_id: 'u1', numero: 1000, items,
    nombre: 'Ana', nota: null, telefono: null, created_at: new Date().toISOString(),
    estado: 'confirmado', metodo_entrega: 'retiro', direccion: null,
    zona: null, zona_id: null, zona_nombre: null, costo_envio: null,
    franja_id: null, fecha_entrega: null, sucursal_id: null, sucursal_armado: null,
    entre_calles: null, piso_depto: null, receptor_nombre: null, receptor_telefono: null,
    bultos: null, motivo_ausente: null,
  };
}

function sbMock(data: { codigo: string; precio: number; stock: number | null }[]) {
  return { rpc: vi.fn(() => Promise.resolve({ data, error: null })) } as never;
}

describe('PedidoCard — precio en vivo', () => {
  it('todos los ítems con precio: muestra precio por ítem y "Total"', async () => {
    const sb = sbMock([{ codigo: '111', precio: 1000, stock: 5 }, { codigo: '222', precio: 500, stock: 0 }]);
    const items: Pedido['items'] = [{ t: 'Globo', q: 2, c: '111' }, { t: 'Sombrero', q: 1, c: '222' }];

    render(<PedidoCard sb={sb} pedido={pedidoBase(items)} datosEnvios={null} onActualizar={() => {}} onAvisar={() => {}} />);

    expect(await screen.findByText(/Total: \$\s*2\.500/)).toBeInTheDocument();
    expect((sb as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith('catalogo_precios_admin', { p_codigos: ['111', '222'] });
  });

  it('un ítem sin precio en la respuesta: muestra "Subtotal" + cuántos faltan, nunca "Total"', async () => {
    const sb = sbMock([{ codigo: '111', precio: 1000, stock: 5 }]);
    const items: Pedido['items'] = [{ t: 'Globo', q: 1, c: '111' }, { t: 'Desconocido', q: 1, c: '999' }];

    render(<PedidoCard sb={sb} pedido={pedidoBase(items)} datosEnvios={null} onActualizar={() => {}} onAvisar={() => {}} />);

    expect(await screen.findByText(/Subtotal:.*\(1 sin precio\)/)).toBeInTheDocument();
    expect(screen.queryByText(/^Total:/)).not.toBeInTheDocument();
  });

  it('ningún ítem con código: no rompe, muestra "sin precios disponibles"', async () => {
    const sb = sbMock([]);
    const items: Pedido['items'] = [{ t: 'De la maqueta HTML vieja', q: 1 }];

    render(<PedidoCard sb={sb} pedido={pedidoBase(items)} datosEnvios={null} onActualizar={() => {}} onAvisar={() => {}} />);

    expect(await screen.findByText('Sin precios disponibles.')).toBeInTheDocument();
    expect((sb as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });
});
