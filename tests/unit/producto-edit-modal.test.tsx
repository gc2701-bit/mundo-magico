/* app/components/admin/ProductoEditModal.tsx — Sprint 3 del plan de
 * catálogo admin (SPEC-catalogo-admin-variantes.md sección 5): la edición
 * de un producto publicado pasa de ser una pantalla que reemplazaba la
 * lista a un Dialog superpuesto, con los campos reordenados (Código ·
 * Nombre · Mundo · Familia arriba), el toggle nuevo de "carrusel del
 * home" y las fotos al fondo.
 *
 * Mismo criterio que publicado-tab.test.tsx: sin e2e Playwright contra
 * sesión admin real (Turnstile lo bloquea en este entorno, ver el
 * comentario de tests/e2e-next/admin-catalogo.spec.js) — se monta el
 * componente de verdad con un doble de supabaseBrowser().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductoEditModal from '../../app/components/admin/ProductoEditModal';

const { sb, escrituras, storageRemovidas } = vi.hoisted(() => {
  const escrituras: any[] = [];
  const storageRemovidas: string[] = [];

  function resultado(data: any) {
    const p: any = Promise.resolve({ data, error: null });
    p.select = () => p;
    p.order = () => p;
    p.eq = () => p;
    p.in = () => p;
    return p;
  }

  function armarEscritura(tabla: string, tipo: 'update' | 'delete' | 'insert', campos?: any) {
    const registro: any = { tabla, tipo, campos, eqs: [], ins: [] };
    escrituras.push(registro);
    const chain: any = resultado(tipo === 'insert' ? [{ id: 'nuevo' }] : {});
    chain.eq = (k: string, v: any) => { registro.eqs.push([k, v]); return chain; };
    chain.in = (k: string, v: any) => { registro.ins.push([k, v]); return chain; };
    return chain;
  }

  const sb = {
    from: (tabla: string) => ({
      select: () => resultado([]),
      update: (campos: any) => armarEscritura(tabla, 'update', campos),
      delete: () => armarEscritura(tabla, 'delete'),
      insert: (campos: any) => armarEscritura(tabla, 'insert', campos)
    }),
    storage: {
      from: () => ({
        remove: (rutas: string[]) => {
          storageRemovidas.push(...rutas);
          return Promise.resolve({ data: null, error: null });
        }
      })
    }
  };

  return { sb, escrituras, storageRemovidas };
});

vi.mock('@/lib/supabase', () => ({ supabaseBrowser: () => sb }));

function producto(overrides: any) {
  return {
    id: 'p1', titulo: 'Anteojo estrella', slug: 'anteojo-estrella', codigo: '001',
    variantes: null, familia: 'RUIDO', mundo: 'cotillon', publicado: true, fotos: [],
    specs: null, descripcion: null, tags: null, orden: 0, destacadoHome: false,
    ...overrides
  };
}

const MUNDOS = [
  { slug: 'cotillon', nombre: 'Cotillón' },
  { slug: 'disfraces', nombre: 'Disfraces' }
];
const FAMILIAS = ['RUIDO', 'LUMINOSOS'];

function montar(overrides: any = {}, cerrar = vi.fn(), actualizado = vi.fn(), eliminado = vi.fn()) {
  render(
    <ProductoEditModal
      producto={producto(overrides)}
      familiasConocidas={FAMILIAS}
      mundosConocidos={MUNDOS}
      todos={[producto(overrides)]}
      onCerrar={cerrar}
      onActualizado={actualizado}
      onEliminado={eliminado}
    />
  );
  return { cerrar, actualizado, eliminado };
}

beforeEach(() => {
  escrituras.length = 0;
  storageRemovidas.length = 0;
});

describe('ProductoEditModal — layout', () => {
  it('sin producto (null) no renderiza nada', () => {
    render(
      <ProductoEditModal producto={null} familiasConocidas={[]} mundosConocidos={[]} todos={[]} onCerrar={vi.fn()} onActualizado={vi.fn()} onEliminado={vi.fn()} />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('los campos aparecen en orden Código, Nombre, Mundo, Familia', () => {
    montar();
    const etiquetas = screen.getAllByText(/^(Código|Nombre|Mundo|Familia)/).map((n) => n.textContent);
    expect(etiquetas[0]).toMatch(/^Código/);
    expect(etiquetas[1]).toMatch(/^Nombre/);
    expect(etiquetas[2]).toMatch(/^Mundo/);
    expect(etiquetas[3]).toMatch(/^Familia/);
  });

  it('las fotos van al fondo, después de los campos editables', () => {
    render(
      <ProductoEditModal producto={producto({})} familiasConocidas={FAMILIAS} mundosConocidos={MUNDOS} todos={[]} onCerrar={vi.fn()} onActualizado={vi.fn()} onEliminado={vi.fn()} />
    );
    // El Dialog se monta en un portal (document.body), no dentro del
    // `container` de render() — se busca en todo el documento.
    const campos = document.querySelector('.adm-detalle-campos-editables');
    const fotos = document.querySelector('.adm-detalle-fotos');
    expect(campos).toBeTruthy();
    expect(fotos).toBeTruthy();
    // compareDocumentPosition: DOCUMENT_POSITION_FOLLOWING (4) si `fotos` viene después de `campos`.
    expect(campos!.compareDocumentPosition(fotos!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('cerrar con el botón "Close" del Dialog llama onCerrar sin escribir nada', async () => {
    const user = userEvent.setup();
    const { cerrar } = montar();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(escrituras).toHaveLength(0);
  });
});

describe('ProductoEditModal — guardar', () => {
  it('edita título/mundo/familia y persiste en catalogo_productos por id', async () => {
    const user = userEvent.setup();
    const { actualizado } = montar({ id: 'p1' });

    const nombre = screen.getByLabelText('Nombre');
    await user.clear(nombre);
    await user.type(nombre, 'Anteojo estrella nuevo');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const update = escrituras.find((e) => e.tabla === 'catalogo_productos' && e.tipo === 'update');
    expect(update).toBeTruthy();
    expect(update.campos.titulo).toBe('Anteojo estrella nuevo');
    expect(update.eqs).toEqual([['id', 'p1']]);
    expect(actualizado).toHaveBeenCalledWith('p1', expect.objectContaining({ titulo: 'Anteojo estrella nuevo' }));
  });

  it('el toggle "Mostrar en el carrusel del home" arranca en destacadoHome del producto', () => {
    montar({ destacadoHome: true });
    const toggle = screen.getByRole('switch', { name: /carrusel del home/ });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('prender el toggle y guardar manda destacado_home:true (nombre de columna, no destacadoHome)', async () => {
    const user = userEvent.setup();
    const { actualizado } = montar({ destacadoHome: false, id: 'p1' });

    await user.click(screen.getByRole('switch', { name: /carrusel del home/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const update = escrituras.find((e) => e.tabla === 'catalogo_productos' && e.tipo === 'update');
    expect(update.campos.destacado_home).toBe(true);
    expect(update.campos).not.toHaveProperty('destacadoHome');
    expect(actualizado).toHaveBeenCalledWith('p1', expect.objectContaining({ destacadoHome: true }));
  });
});

describe('ProductoEditModal — eliminar', () => {
  it('pide confirmación (window.confirm) antes de borrar', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    montar();

    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(escrituras).toHaveLength(0);
    confirmSpy.mockRestore();
  });

  it('confirmado, borra fotos de Storage, catalogo_precios del código exclusivo y catalogo_productos', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const p = producto({ id: 'p1', codigo: '001', fotos: [{ src: 'https://kyuilrlewynqrzebouww.supabase.co/storage/v1/object/public/catalogo/anteojo.webp', cap: '' }] });
    const eliminado = vi.fn();
    render(
      <ProductoEditModal producto={p} familiasConocidas={FAMILIAS} mundosConocidos={MUNDOS} todos={[p]} onCerrar={vi.fn()} onActualizado={vi.fn()} onEliminado={eliminado} />
    );

    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    expect(storageRemovidas).toEqual(['anteojo.webp']);
    const delPrecios = escrituras.find((e) => e.tabla === 'catalogo_precios' && e.tipo === 'delete');
    expect(delPrecios.ins).toEqual([['codigo', ['001']]]);
    const delProducto = escrituras.find((e) => e.tabla === 'catalogo_productos' && e.tipo === 'delete');
    expect(delProducto.eqs).toEqual([['id', 'p1']]);
    expect(eliminado).toHaveBeenCalledWith('p1');

    vi.restoreAllMocks();
  });
});
