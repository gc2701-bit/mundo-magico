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
import { subirFoto } from '@/lib/procesar-foto';

const { sb, escrituras, storageRemovidas, composicionPorCodigo } = vi.hoisted(() => {
  const escrituras: any[] = [];
  const storageRemovidas: string[] = [];
  const composicionPorCodigo: Record<string, any[]> = {};

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
    },
    rpc: (nombre: string, args: any) => {
      if (nombre !== 'combo_composicion') return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: composicionPorCodigo[args?.p_codigo] || [], error: null });
    }
  };

  return { sb, escrituras, storageRemovidas, composicionPorCodigo };
});

vi.mock('@/lib/supabase', () => ({ supabaseBrowser: () => sb }));

// procesarFoto usa createImageBitmap/canvas — jsdom no lo simula (mismo
// motivo por el que lib/procesar-foto.ts no tiene test unitario propio,
// ver su comentario). Se stubea para poder probar el flujo de "subir
// imagen a una variante" sin canvas real.
vi.mock('@/lib/procesar-foto', () => ({
  procesarFoto: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/webp' })),
  subirFoto: vi.fn().mockResolvedValue('https://kyuilrlewynqrzebouww.supabase.co/storage/v1/object/public/catalogo/variante.webp')
}));

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
const MAPA_PRECIOS = { '001': { precio: 1000, stock: 5 } };

function montar(overrides: any = {}, cerrar = vi.fn(), actualizado = vi.fn(), eliminado = vi.fn()) {
  render(
    <ProductoEditModal
      producto={producto(overrides)}
      familiasConocidas={FAMILIAS}
      mundosConocidos={MUNDOS}
      todos={[producto(overrides)]}
      mapaPrecios={MAPA_PRECIOS}
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
  (subirFoto as any).mockClear();
});

describe('ProductoEditModal — layout', () => {
  it('sin producto (null) no renderiza nada', () => {
    render(
      <ProductoEditModal producto={null} familiasConocidas={[]} mundosConocidos={[]} todos={[]} mapaPrecios={{}} onCerrar={vi.fn()} onActualizado={vi.fn()} onEliminado={vi.fn()} />
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
      <ProductoEditModal producto={producto({})} familiasConocidas={FAMILIAS} mundosConocidos={MUNDOS} todos={[]} mapaPrecios={MAPA_PRECIOS} onCerrar={vi.fn()} onActualizado={vi.fn()} onEliminado={vi.fn()} />
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
      <ProductoEditModal producto={p} familiasConocidas={FAMILIAS} mundosConocidos={MUNDOS} todos={[p]} mapaPrecios={MAPA_PRECIOS} onCerrar={vi.fn()} onActualizado={vi.fn()} onEliminado={eliminado} />
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

describe('ProductoEditModal — editor de variantes', () => {
  it('"+ Agregar variante" suma una fila vacía y activa, y el código simple queda deshabilitado', async () => {
    const user = userEvent.setup();
    montar({ codigo: '001', variantes: null });

    await user.click(screen.getByRole('button', { name: '+ Agregar variante' }));

    expect(screen.getByText(/este producto tiene variantes/)).toBeInTheDocument();
    const checkboxesActivo = screen.getAllByRole('checkbox', { name: 'A la venta' });
    expect(checkboxesActivo).toHaveLength(1);
    expect(checkboxesActivo[0]).toBeChecked();
  });

  it('completar talle/tipo/código de una variante nueva y guardar la persiste en catalogo_productos.variantes', async () => {
    const user = userEvent.setup();
    const { actualizado } = montar({ id: 'p1', codigo: '001', variantes: null });

    await user.click(screen.getByRole('button', { name: '+ Agregar variante' }));
    await user.type(screen.getByPlaceholderText('Ej: Chico'), 'Chico');
    await user.type(screen.getByPlaceholderText('Ej: Rojo'), 'Rojo');
    // Con 1+ variante el label del código simple de arriba cambia a
    // "Código (este producto tiene variantes...)" — el único label con el
    // texto accesible exacto "Código" pasa a ser el de la fila.
    await user.type(screen.getByLabelText('Código'), 'V001');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const update = escrituras.find((e) => e.tabla === 'catalogo_productos' && e.tipo === 'update');
    expect(update.campos.variantes).toEqual([{ talle: 'Chico', tipo: 'Rojo', codigo: 'V001', imagen: undefined, activo: true }]);
    expect(update.campos.codigo).toBeNull(); // el código simple se limpia: ahora manda la lista de variantes
    expect(actualizado).toHaveBeenCalledWith('p1', expect.objectContaining({
      variantes: [{ talle: 'Chico', tipo: 'Rojo', codigo: 'V001', imagen: undefined, activo: true }]
    }));
  });

  it('guardar con una variante sin código bloquea y no escribe nada', async () => {
    const user = userEvent.setup();
    montar({ variantes: null });

    await user.click(screen.getByRole('button', { name: '+ Agregar variante' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByText('Cada variante necesita un código.')).toBeInTheDocument();
    expect(escrituras).toHaveLength(0);
  });

  it('desactivar ("a la venta") una variante existente y guardar persiste activo:false', async () => {
    const user = userEvent.setup();
    const existentes = [{ talle: 'Chico', codigo: 'V001', activo: true }, { talle: 'Grande', codigo: 'V002', activo: true }];
    const { actualizado } = montar({ id: 'p1', codigo: null, variantes: existentes });

    const checkboxes = screen.getAllByRole('checkbox', { name: 'A la venta' });
    expect(checkboxes).toHaveLength(2);
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const update = escrituras.find((e) => e.tabla === 'catalogo_productos' && e.tipo === 'update');
    expect(update.campos.variantes).toEqual([
      { talle: 'Chico', tipo: undefined, codigo: 'V001', imagen: undefined, activo: false },
      { talle: 'Grande', tipo: undefined, codigo: 'V002', imagen: undefined, activo: true }
    ]);
    expect(actualizado).toHaveBeenCalled();
  });

  it('"Quitar" saca la fila de la lista sin tocar las demás', async () => {
    const user = userEvent.setup();
    const existentes = [{ talle: 'Chico', codigo: 'V001', activo: true }, { talle: 'Grande', codigo: 'V002', activo: true }];
    montar({ codigo: null, variantes: existentes });

    const filas = screen.getAllByRole('button', { name: 'Quitar' });
    await user.click(filas[0]);

    expect(screen.getAllByRole('checkbox', { name: 'A la venta' })).toHaveLength(1);
    expect(screen.getByDisplayValue('Grande')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Chico')).not.toBeInTheDocument();
  });

  it('quitar todas las variantes reactiva el código simple', async () => {
    const user = userEvent.setup();
    const existentes = [{ talle: 'Chico', codigo: 'V001', activo: true }];
    montar({ codigo: null, variantes: existentes });

    await user.click(screen.getByRole('button', { name: 'Quitar' }));

    expect(screen.queryByText(/este producto tiene variantes/)).not.toBeInTheDocument();
  });

  it('muestra precio/stock de sólo lectura desde mapaPrecios para el código de la fila', () => {
    montar({ codigo: null, variantes: [{ talle: 'Chico', codigo: '001', activo: true }] }); // '001' está en MAPA_PRECIOS
    expect(screen.getByText(/stock 5/)).toBeInTheDocument();
  });

  it('un código sin dato en mapaPrecios muestra "Sin datos de precio todavía", no inventa nada', () => {
    montar({ codigo: null, variantes: [{ talle: 'Chico', codigo: 'NUEVO-999', activo: true }] });
    expect(screen.getByText('Sin datos de precio todavía')).toBeInTheDocument();
  });

  it('subir una imagen a una variante la asocia a esa fila, y guardar la persiste', async () => {
    const user = userEvent.setup();
    const existentes = [{ talle: 'Chico', codigo: 'V001', activo: true }];
    const { actualizado } = montar({ id: 'p1', codigo: null, variantes: existentes });

    const archivo = new File(['x'], 'chico.webp', { type: 'image/webp' });
    const inputArchivo = screen.getByLabelText('Imagen') as HTMLInputElement;
    await user.upload(inputArchivo, archivo);

    await screen.findByAltText(''); // el <img> de miniatura aparece cuando termina de subir

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const update = escrituras.find((e) => e.tabla === 'catalogo_productos' && e.tipo === 'update');
    expect(update.campos.variantes[0].imagen).toBe('https://kyuilrlewynqrzebouww.supabase.co/storage/v1/object/public/catalogo/variante.webp');
    expect(actualizado).toHaveBeenCalled();
  });
});

describe('ProductoEditModal — composición de combo (Sprint 6)', () => {
  beforeEach(() => {
    for (const k of Object.keys(composicionPorCodigo)) delete composicionPorCodigo[k];
  });

  it('sin composición para el código del producto, no muestra la sección', async () => {
    montar({ codigo: 'SOLO' });
    await screen.findByText('Anteojo estrella'); // esperar a que el useEffect corra
    expect(screen.queryByText(/Composición/)).not.toBeInTheDocument();
  });

  it('con composición, lista "cantidad× nombre" para el código propio del producto', async () => {
    composicionPorCodigo['COMBO1'] = [
      { nombre: 'SOMBRERO', cantidad: 2 },
      { nombre: 'ANTIFAZ', cantidad: 1 }
    ];
    montar({ codigo: 'COMBO1' });

    expect(await screen.findByText(/Composición/)).toBeInTheDocument();
    expect(screen.getByText('2× SOMBRERO')).toBeInTheDocument();
    expect(screen.getByText('1× ANTIFAZ')).toBeInTheDocument();
  });

  it('con variantes en vez de código simple, consulta la composición por cada código propio', async () => {
    composicionPorCodigo['V002'] = [{ nombre: 'ANTIFAZ', cantidad: 3 }];
    montar({
      codigo: null,
      variantes: [
        { talle: 'Chico', codigo: 'V001', activo: true },
        { talle: 'Grande', codigo: 'V002', activo: true }
      ]
    });

    expect(await screen.findByText('3× ANTIFAZ')).toBeInTheDocument();
  });
});

describe('ProductoEditModal — sanea la carpeta antes de subir foto (mismo bug de raíz que EspejoTab.tsx, ver tasks/plan-activar-invalid-key.md)', () => {
  it('agregar foto general: la carpeta (de familia con tilde) llega ASCII-safe a subirFoto', async () => {
    const user = userEvent.setup();
    montar({ familia: 'Decoración' });

    const input = screen.getByLabelText(/Agregar foto/);
    await user.upload(input, new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));

    expect(subirFoto).toHaveBeenCalledTimes(1);
    const [, , carpeta] = (subirFoto as any).mock.calls[0];
    expect(carpeta).toBe('decoracion');
  });

  it('subir imagen de una variante: la carpeta (de familia con tilde) llega ASCII-safe a subirFoto', async () => {
    const user = userEvent.setup();
    montar({
      familia: 'Decoración',
      codigo: null,
      variantes: [{ talle: 'Chico', codigo: '001', activo: true }]
    });

    const input = screen.getByLabelText('Imagen');
    await user.upload(input, new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));

    expect(subirFoto).toHaveBeenCalledTimes(1);
    const [, , carpeta] = (subirFoto as any).mock.calls[0];
    expect(carpeta).toBe('decoracion');
  });
});
