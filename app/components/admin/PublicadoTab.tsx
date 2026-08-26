'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import type { ProductoPublico } from '@/lib/catalogo-familia';
import {
  codigosDe,
  codigosBorrablesLote,
  familiasVistas,
  contarSinFamilia,
  rutasDeStorage,
  precioStockDe,
  ordenarCatalogo,
  filtrarCatalogo,
  estadoSeleccionEncabezado,
  redondearPrecio,
  SIN_FAMILIA,
  type MapaPreciosAdmin,
  type FilaCatalogoAdmin,
  type ColumnaOrdenCatalogo
} from '@/lib/admin-catalogo';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, ArrowUpDown, Percent, Trash2, EyeOff, Loader2 } from 'lucide-react';
import ProductoEditModal, { type ProductoAdmin } from './ProductoEditModal';

const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

// Anchos en % (no px): en table-fixed la suma nunca puede superar el 100%
// del contenedor, así que la tabla no puede desbordar sin importar el
// ancho de pantalla — a diferencia de whitespace-nowrap + overflow-x-auto
// (lo que había antes), que dejaba el scroll horizontal pegado al fondo
// de una lista larga y sin paginar, inalcanzable sin bajar hasta el final
// (reportado por el usuario: no podía ni ver los datos completos ni
// llegar a "Editar" sin ese doble scroll). checkbox 4% + editar 9% +
// las 7 de abajo (87%) = 100%.
const COLUMNAS: { col: ColumnaOrdenCatalogo; label: string; alinear?: 'right'; widthPct: number }[] = [
  { col: 'codigo', label: 'Código', widthPct: 11 },
  { col: 'titulo', label: 'Nombre', widthPct: 26 },
  { col: 'familia', label: 'Familia', widthPct: 12 },
  { col: 'mundo', label: 'Mundo', widthPct: 12 },
  { col: 'stock', label: 'Stock', alinear: 'right', widthPct: 7 },
  { col: 'precio', label: 'Precio', alinear: 'right', widthPct: 10 },
  { col: 'estado', label: 'Estado', widthPct: 9 }
];

export default function PublicadoTab() {
  const [productos, setProductos] = useState<ProductoAdmin[]>([]);
  const [mapaPrecios, setMapaPrecios] = useState<MapaPreciosAdmin>({});
  const [mundos, setMundos] = useState<{ slug: string; nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [familiaFiltro, setFamiliaFiltro] = useState('');
  const [mundoFiltro, setMundoFiltro] = useState('');
  const [columna, setColumna] = useState<ColumnaOrdenCatalogo>('titulo');
  const [direccion, setDireccion] = useState<'asc' | 'desc'>('asc');
  const [seleccionado, setSeleccionado] = useState<ProductoAdmin | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [pasoPrecio, setPasoPrecio] = useState(false);
  const [porcentaje, setPorcentaje] = useState('');
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [loteCargando, setLoteCargando] = useState(false);
  const [loteError, setLoteError] = useState('');

  useEffect(() => {
    cargar();
    supabaseBrowser()
      .from('catalogo_mundos')
      .select('slug, nombre')
      .order('orden')
      .then(({ data }) => setMundos(data || []));
  }, []);

  async function cargar() {
    setCargando(true);
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from('catalogo_productos')
      .select('id, titulo, slug, codigo, specs, descripcion, tags, variantes, fotos, familia, publicado, mundo, subcategoriaId:subcategoria_id, orden, destacadoHome:destacado_home')
      .order('titulo');
    if (!error && data) {
      const lista = data as ProductoAdmin[];
      setProductos(lista);
      const codigos = Array.from(new Set(lista.flatMap((p) => codigosDe(p))));
      if (codigos.length) {
        const { data: precios } = await sb.rpc('catalogo_precios_admin', { p_codigos: codigos });
        const mapa: MapaPreciosAdmin = {};
        (precios || []).forEach((r: { codigo: string; precio: number; stock: number | null }) => {
          mapa[r.codigo] = { precio: r.precio, stock: r.stock };
        });
        setMapaPrecios(mapa);
      } else {
        setMapaPrecios({});
      }
    }
    setCargando(false);
  }

  const sinFamilia = contarSinFamilia(productos);
  const familias = familiasVistas(productos);

  const filasBase: FilaCatalogoAdmin[] = useMemo(
    () =>
      productos.map((p) => {
        const { precio, stock } = precioStockDe(p, mapaPrecios);
        return {
          id: p.id,
          codigo: codigosDe(p).join(', ') || '—',
          titulo: p.titulo,
          familia: p.familia,
          mundoSlug: p.mundo,
          mundoNombre: mundos.find((m) => m.slug === p.mundo)?.nombre || p.mundo,
          stock,
          precio,
          publicado: p.publicado
        };
      }),
    [productos, mapaPrecios, mundos]
  );

  const filas = useMemo(
    () =>
      ordenarCatalogo(
        filtrarCatalogo(filasBase, { busqueda, familia: familiaFiltro, mundoSlug: mundoFiltro }),
        columna,
        direccion
      ),
    [filasBase, busqueda, familiaFiltro, mundoFiltro, columna, direccion]
  );

  // Un filtro nuevo puede esconder filas que estaban seleccionadas —
  // limpiar la selección evita actuar "en lote" sobre algo que ya no se ve
  // ni se recuerda haber elegido. Ordenar (columna/dirección) no cambia
  // QUÉ está seleccionado, sólo el orden, así que no limpia acá.
  useEffect(() => {
    setSeleccionados(new Set());
    setPasoPrecio(false);
    setConfirmarEliminar(false);
    setPorcentaje('');
    setLoteError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, familiaFiltro, mundoFiltro]);

  const estadoEncabezado = estadoSeleccionEncabezado(filas, seleccionados);

  function alternarSeleccionTodos() {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (estadoEncabezado === 'todos') {
        filas.forEach((f) => next.delete(f.id));
      } else {
        filas.forEach((f) => next.add(f.id));
      }
      return next;
    });
  }

  function alternarSeleccionUna(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function limpiarSeleccion() {
    setSeleccionados(new Set());
    setPasoPrecio(false);
    setConfirmarEliminar(false);
    setPorcentaje('');
    setLoteError('');
  }

  function productosSeleccionados(): ProductoAdmin[] {
    return productos.filter((p) => seleccionados.has(p.id));
  }

  async function ejecutarAjustePrecio() {
    const pct = Number(porcentaje);
    if (!porcentaje || Number.isNaN(pct)) return;
    setLoteCargando(true);
    setLoteError('');
    try {
      const sb = supabaseBrowser();
      const codigos = Array.from(new Set(productosSeleccionados().flatMap((p) => codigosDe(p))));
      const actualizaciones = codigos
        .map((c) => ({ codigo: c, actual: mapaPrecios[c]?.precio }))
        .filter((x): x is { codigo: string; actual: number } => x.actual != null);
      await Promise.all(
        actualizaciones.map(({ codigo, actual }) =>
          sb.from('catalogo_precios').update({ precio: redondearPrecio(actual, pct) }).eq('codigo', codigo)
        )
      );
      limpiarSeleccion();
      await cargar();
    } catch (err) {
      setLoteError((err as Error).message);
    } finally {
      setLoteCargando(false);
    }
  }

  async function ejecutarSacarDeUso() {
    setLoteCargando(true);
    setLoteError('');
    try {
      const sb = supabaseBrowser();
      const { error: err } = await sb
        .from('catalogo_productos')
        .update({ publicado: false })
        .in('id', Array.from(seleccionados));
      if (err) throw err;
      limpiarSeleccion();
      await cargar();
    } catch (err) {
      setLoteError((err as Error).message);
    } finally {
      setLoteCargando(false);
    }
  }

  async function ejecutarEliminarLote() {
    setLoteCargando(true);
    setLoteError('');
    try {
      const sb = supabaseBrowser();
      const seleccion = productosSeleccionados();
      const borrables = codigosBorrablesLote(seleccion, productos);
      const rutasStorage = Array.from(new Set(seleccion.flatMap((p) => rutasDeStorage(p.fotos || []))));
      if (rutasStorage.length) {
        await sb.storage.from('catalogo').remove(rutasStorage);
      }
      if (borrables.length) {
        await sb.from('catalogo_precios').delete().in('codigo', borrables);
      }
      const { error: err } = await sb.from('catalogo_productos').delete().in('id', Array.from(seleccionados));
      if (err) throw err;
      limpiarSeleccion();
      await cargar();
    } catch (err) {
      setLoteError((err as Error).message);
    } finally {
      setLoteCargando(false);
    }
  }

  function alOrdenar(col: ColumnaOrdenCatalogo) {
    if (columna === col) {
      setDireccion((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setColumna(col);
      setDireccion('asc');
    }
  }

  function SortIcon({ col }: { col: ColumnaOrdenCatalogo }) {
    if (columna !== col) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />;
    return direccion === 'asc' ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  }

  function actualizarLocal(id: string, campos: Partial<ProductoAdmin>) {
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, ...campos } : p)));
    setSeleccionado((prev) => (prev && prev.id === id ? { ...prev, ...campos } : prev));
  }

  function quitarLocal(id: string) {
    setProductos((prev) => prev.filter((p) => p.id !== id));
    setSeleccionado((prev) => (prev && prev.id === id ? null : prev));
  }

  function abrirEdicion(id: string) {
    const p = productos.find((prod) => prod.id === id);
    if (p) setSeleccionado(p);
  }

  if (cargando) return <p className="adm-detalle-solo-lectura">Cargando…</p>;

  return (
    <div className="space-y-3">
      <ProductoEditModal
        producto={seleccionado}
        familiasConocidas={familias}
        mundosConocidos={mundos}
        todos={productos}
        mapaPrecios={mapaPrecios}
        onCerrar={() => setSeleccionado(null)}
        onActualizado={actualizarLocal}
        onEliminado={quitarLocal}
      />
      <div className="adm-lista-toolbar flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Buscar por título o código"
          aria-label="Buscar productos"
          className="sm:w-64"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Select value={familiaFiltro || '__todas__'} onValueChange={(v) => setFamiliaFiltro(v === '__todas__' ? '' : (v as string))}>
          <SelectTrigger className="sm:w-48" aria-label="Filtrar por familia">
            <SelectValue placeholder="Todas las familias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todas__">Todas las familias</SelectItem>
            <SelectItem value={SIN_FAMILIA}>— sin familia — ({sinFamilia})</SelectItem>
            {familias.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mundoFiltro || '__todos__'} onValueChange={(v) => setMundoFiltro(v === '__todos__' ? '' : (v as string))}>
          <SelectTrigger className="sm:w-48" aria-label="Filtrar por mundo">
            <SelectValue placeholder="Todos los mundos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los mundos</SelectItem>
            {mundos.map((m) => (
              <SelectItem key={m.slug} value={m.slug}>
                {m.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {seleccionados.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
          <span className="shrink-0 text-sm font-medium">
            {seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}
            {estadoEncabezado === 'todos' && filas.length > 1 ? ` (los ${filas.length} filtrados)` : ''}
          </span>

          {!pasoPrecio && !confirmarEliminar && (
            <>
              <Button type="button" variant="outline" size="sm" disabled={loteCargando} onClick={() => setPasoPrecio(true)}>
                <Percent className="mr-1.5 h-3.5 w-3.5" />
                Ajustar precio
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={loteCargando} onClick={ejecutarSacarDeUso}>
                <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                Sacar de uso
              </Button>
              <Button type="button" variant="destructive" size="sm" disabled={loteCargando} onClick={() => setConfirmarEliminar(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Eliminar
              </Button>
            </>
          )}

          {pasoPrecio && (
            <>
              <span className="text-sm text-muted-foreground">Ajuste %</span>
              <Input
                type="number"
                className="w-24"
                placeholder="Ej: 10"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && porcentaje && ejecutarAjustePrecio()}
              />
              <span className="text-xs text-muted-foreground">(negativo para bajar)</span>
              <Button type="button" size="sm" disabled={loteCargando || !porcentaje} onClick={ejecutarAjustePrecio}>
                {loteCargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Aplicar'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setPasoPrecio(false); setPorcentaje(''); }}>
                Cancelar
              </Button>
            </>
          )}

          {confirmarEliminar && (
            <>
              <span className="text-sm font-medium text-destructive">
                ¿Eliminar {seleccionados.size} producto{seleccionados.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.
              </span>
              <Button type="button" variant="destructive" size="sm" disabled={loteCargando} onClick={ejecutarEliminarLote}>
                {loteCargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirmar eliminación'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmarEliminar(false)}>
                Cancelar
              </Button>
            </>
          )}

          <Button type="button" variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={limpiarSeleccion}>
            Limpiar selección
          </Button>
        </div>
      )}
      {loteError && <p className="adm-msg adm-msg-error">{loteError}</p>}

      {/* Desktop (≥1024px, breakpoint lg): tabla real. Debajo de 1024px,
       * con 9 columnas efectivas, ni siquiera con wrap queda cómodo — pasa
       * a la lista de tarjetas de abajo. Mismo patrón de dos bloques de
       * markup que ya usa Footer.tsx en este repo (CSS puro, sin JS de
       * media queries — evita el flash de hidratación de un hook). */}
      <div className="hidden lg:block">
        <Table className="adm-lista-tabla table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: '4%' }}>
                <Checkbox
                  checked={estadoEncabezado === 'todos'}
                  indeterminate={estadoEncabezado === 'algunos'}
                  onCheckedChange={alternarSeleccionTodos}
                  aria-label="Seleccionar todos"
                />
              </TableHead>
              {COLUMNAS.map(({ col, label, alinear, widthPct }) => (
                <TableHead
                  key={col}
                  style={{ width: `${widthPct}%` }}
                  className={'cursor-pointer select-none whitespace-nowrap hover:text-foreground' + (alinear === 'right' ? ' text-right' : '')}
                  onClick={() => alOrdenar(col)}
                >
                  {label}
                  <SortIcon col={col} />
                </TableHead>
              ))}
              <TableHead style={{ width: '9%' }} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS.length + 2} className="adm-detalle-solo-lectura text-center">
                  No hay artículos que coincidan.
                </TableCell>
              </TableRow>
            ) : (
              filas.map((f) => (
                <TableRow key={f.id} className={seleccionados.has(f.id) ? 'bg-muted/30' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={seleccionados.has(f.id)}
                      onCheckedChange={() => alternarSeleccionUna(f.id)}
                      aria-label={`Seleccionar ${f.titulo}`}
                    />
                  </TableCell>
                  <TableCell className="whitespace-normal break-words font-mono text-sm text-muted-foreground">{f.codigo}</TableCell>
                  <TableCell className="whitespace-normal break-words font-medium">{f.titulo}</TableCell>
                  <TableCell className="truncate" title={f.familia || undefined}>
                    {f.familia || <span className="adm-badge-sin-stock">sin familia</span>}
                  </TableCell>
                  <TableCell className="truncate" title={f.mundoNombre}>{f.mundoNombre}</TableCell>
                  <TableCell className="text-right">{f.stock == null ? '—' : f.stock}</TableCell>
                  <TableCell className="text-right">{f.precio == null ? '—' : fmt.format(f.precio)}</TableCell>
                  <TableCell>{f.publicado ? 'Visible' : 'Oculto'}</TableCell>
                  <TableCell>
                    <button type="button" className="btn btn-ghost" onClick={() => abrirEdicion(f.id)}>
                      Editar
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile (<1024px): una tarjeta por artículo en vez de tabla — sin
       * columnas no hay scroll horizontal posible, y se ve toda la
       * información de una, sin tener que elegir qué mostrar. */}
      <ul role="list" className="grid gap-3 lg:hidden">
        {filas.length === 0 ? (
          <li className="adm-detalle-solo-lectura list-none text-center">No hay artículos que coincidan.</li>
        ) : (
          filas.map((f) => (
            <li
              key={f.id}
              className={'list-none rounded-lg border p-3' + (seleccionados.has(f.id) ? ' bg-muted/30' : '')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={seleccionados.has(f.id)}
                    onCheckedChange={() => alternarSeleccionUna(f.id)}
                    aria-label={`Seleccionar ${f.titulo}`}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium break-words">{f.titulo}</p>
                    <p className="break-words font-mono text-xs text-muted-foreground">{f.codigo}</p>
                  </div>
                </div>
                <button type="button" className="btn btn-ghost shrink-0" onClick={() => abrirEdicion(f.id)}>
                  Editar
                </button>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <div>
                  <dt className="text-muted-foreground">Familia</dt>
                  <dd>{f.familia || 'sin familia'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Mundo</dt>
                  <dd>{f.mundoNombre}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Stock</dt>
                  <dd>{f.stock == null ? '—' : f.stock}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Precio</dt>
                  <dd>{f.precio == null ? '—' : fmt.format(f.precio)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">{f.publicado ? 'Visible' : 'Oculto'}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
