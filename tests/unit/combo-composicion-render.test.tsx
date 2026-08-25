/* app/components/ComboComposicion.tsx — "Este combo incluye: ..." en la
 * ficha de producto (Sprint 6 del plan de catálogo admin).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ComboComposicion from '../../app/components/ComboComposicion';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabaseBrowser: () => ({ rpc }) }));

beforeEach(() => {
  rpc.mockReset();
});

describe('ComboComposicion', () => {
  it('sin código, no renderiza nada ni llama a la RPC', () => {
    const { container } = render(<ComboComposicion codigo={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('código sin composición (no es combo, o no publicado todavía): no renderiza nada', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { container } = render(<ComboComposicion codigo="NOCOMBO" />);
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('combo_composicion', { p_codigo: 'NOCOMBO' }));
    expect(container).toBeEmptyDOMElement();
  });

  it('con composición, lista "cantidad× nombre" tal cual viene (sin normalizar mayúsculas)', async () => {
    rpc.mockResolvedValue({
      data: [{ nombre: 'SOMBRERO', cantidad: 2 }, { nombre: 'ANTIFAZ', cantidad: 1 }],
      error: null
    });
    render(<ComboComposicion codigo="COMBO1" />);

    expect(await screen.findByText('Este combo incluye:')).toBeInTheDocument();
    expect(screen.getByText('2× SOMBRERO')).toBeInTheDocument();
    expect(screen.getByText('1× ANTIFAZ')).toBeInTheDocument();
  });

  it('error de la RPC: no rompe, no muestra nada (nunca inventa datos)', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('permission denied') });
    const { container } = render(<ComboComposicion codigo="X" />);
    await vi.waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
